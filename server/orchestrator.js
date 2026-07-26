import { run, query, get } from './db.js';
import { generateContent } from './llm.js';
import { SharedMemory, compressHistory } from './memory.js';

// Map to hold in-memory instances of shared memory and WebSocket connections
export const activeSessions = new Map();

// Helper to broadcast WS messages
function broadcast(sessionId, payload) {
  const session = activeSessions.get(sessionId);
  if (session && session.connections) {
    const data = JSON.stringify(payload);
    session.connections.forEach(ws => {
      if (ws.readyState === 1 /* OPEN */) {
        ws.send(data);
      }
    });
  }
}

/**
 * Initializes a new debate session
 */
export async function createDebateSession(topic, maxRounds, config = {}) {
  const sessionId = `session_${Date.now()}`;
  const sessionConfig = {
    debaterModel: config.debaterModel || 'gemini-2.5-flash',
    challengerModel: config.challengerModel || 'gemini-2.5-flash',
    factCheckerModel: config.factCheckerModel || 'gemini-2.5-flash',
    judgeModel: config.judgeModel || 'gemini-2.5-pro',
    enableFactChecker: config.enableFactChecker !== false,
    enableSelfCritique: !!config.enableSelfCritique,
    hitlInterval: config.hitlInterval || 'none' // 'none', 'every_round'
  };

  const sharedMem = new SharedMemory();
  
  // Save to database
  await run(
    `INSERT INTO debates (id, topic, rounds, status, config) VALUES (?, ?, ?, ?, ?)`,
    [sessionId, topic, maxRounds, 'active', JSON.stringify(sessionConfig)]
  );

  activeSessions.set(sessionId, {
    id: sessionId,
    topic,
    maxRounds,
    currentRound: 1,
    status: 'active',
    config: sessionConfig,
    memory: sharedMem,
    connections: new Set(),
    historyCompressed: false,
    compressedSummary: ''
  });

  return sessionId;
}

/**
 * Runs a single step/turn in the debate state machine
 */
export async function stepDebate(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session || session.status !== 'active') return;

  const currentRound = session.currentRound;
  const maxRounds = session.maxRounds;

  // 1. Fetch historical messages for the prompt context
  const rows = await query(
    `SELECT sender, content, round FROM messages WHERE session_id = ? ORDER BY id ASC`,
    [sessionId]
  );
  
  // Check if we should compress context window
  if (rows.length >= 6 && !session.historyCompressed) {
    console.log(`[Context Compression] Condensing debate history for topic: "${session.topic}"`);
    broadcast(sessionId, { type: 'status_update', text: 'Compressing older debate rounds to optimize token context window...' });
    const compressionResult = await compressHistory(rows, session.topic);
    if (compressionResult) {
      session.historyCompressed = true;
      session.compressedSummary = compressionResult.content;
      broadcast(sessionId, { 
        type: 'context_compressed', 
        summary: session.compressedSummary,
        metrics: compressionResult.metrics
      });
    }
  }

  // Determine who should speak next
  // Order per round: Debater -> Challenger -> Fact Checker -> Human (if enabled) -> Next Round (or Judge if final)
  const roundMessages = rows.filter(m => m.round === currentRound);
  const spokeDebater = roundMessages.some(m => m.sender === 'debater');
  const spokeChallenger = roundMessages.some(m => m.sender === 'challenger');
  const spokeFactChecker = roundMessages.some(m => m.sender === 'fact_checker');

  if (!spokeDebater) {
    await executeAgentTurn(session, 'debater', currentRound, rows);
  } else if (!spokeChallenger) {
    await executeAgentTurn(session, 'challenger', currentRound, rows);
  } else if (session.config.enableFactChecker && !spokeFactChecker) {
    await executeAgentTurn(session, 'fact_checker', currentRound, rows);
  } else {
    // Round is completed
    if (session.config.hitlInterval === 'every_round') {
      // Pause for Human-in-the-Loop intervention
      session.status = 'paused';
      await run(`UPDATE debates SET status = 'paused' WHERE id = ?`, [sessionId]);
      broadcast(sessionId, { type: 'hitl_pause', round: currentRound });
      console.log(`[HITL Pause] Paused debate at round ${currentRound} for user input.`);
      return;
    }

    // Go to next round or trigger Judge evaluation
    if (currentRound < maxRounds) {
      session.currentRound += 1;
      // Recurse to run next turn immediately
      setTimeout(() => stepDebate(sessionId), 500);
    } else {
      // It was the final round. Time for the Judge!
      await executeJudgeTurn(session, rows);
    }
  }
}

/**
 * Execute a specific agent turn
 */
async function executeAgentTurn(session, role, round, allMessages) {
  const sessionId = session.id;
  const isSelfCritique = session.config.enableSelfCritique && (role === 'debater' || role === 'challenger');
  
  broadcast(sessionId, { type: 'agent_status', agent: role, status: isSelfCritique ? 'reflecting' : 'thinking' });

  // Compile context from history & memory
  let historyPrompt = '';
  if (session.historyCompressed) {
    historyPrompt = `[Compressed summary of earlier rounds]:\n${session.compressedSummary}\n\n`;
    // Include only recent messages that happened after compression
    const recent = allMessages.slice(-3);
    recent.forEach(m => {
      historyPrompt += `${m.sender.toUpperCase()} (Round ${m.round}): ${m.content}\n\n`;
    });
  } else {
    allMessages.forEach(m => {
      historyPrompt += `${m.sender.toUpperCase()} (Round ${m.round}): ${m.content}\n\n`;
    });
  }

  // Retrieve matching memory/RAG facts
  const queryTerm = allMessages.length > 0 ? allMessages[allMessages.length - 1].content : session.topic;
  const retrieved = session.memory.retrieveContext(queryTerm);
  
  let memoryPrompt = '';
  if (retrieved.recentClaims.length > 0) {
    memoryPrompt += `[Shared Memory - Assertions recorded so far]:\n` + 
      retrieved.recentClaims.map(c => `- ${c.agent.toUpperCase()} claimed: "${c.text}"`).join('\n') + '\n\n';
  }
  if (retrieved.ragGrounding.length > 0) {
    memoryPrompt += `[Grounding Docs Context (RAG)]:\n` + 
      retrieved.ragGrounding.map(r => `Source: ${r.source}\nSnippet: "${r.text}"`).join('\n\n') + '\n\n';
  }

  // Construct final agent prompt
  let systemPrompt = '';
  let model = session.config.debaterModel;

  if (role === 'debater') {
    model = session.config.debaterModel;
    systemPrompt = `You are DEBATER, a world-class rhetoric expert arguing in FAVOR of the topic: "${session.topic}".
Your objective is to construct compelling, persuasive, and logically sound arguments.
- Refer to grounding docs (RAG) context if available.
- Reference claims recorded in shared memory to build on or refute.
- Keep responses civil, precise, and limited to ~150 words. Do not use generic structures.`;
  } else if (role === 'challenger') {
    model = session.config.challengerModel;
    systemPrompt = `You are CHALLENGER, a world-class rhetoric expert arguing AGAINST the topic: "${session.topic}".
Your objective is to dismantle the proponent's arguments, expose logical fallacies, and introduce robust counter-arguments.
- Reference facts from grounding docs (RAG) to refute claims.
- Reference claims recorded in shared memory to counter earlier assertions.
- Keep responses civil, precise, and limited to ~150 words.`;
  } else if (role === 'fact_checker') {
    model = session.config.factCheckerModel;
    systemPrompt = `You are the neutral FACT CHECKER.
Your goal is to cross-examine statements made in the current round (${round}) against the RAG grounding context.
- Identify any claims that are unsupported by the RAG snippets or represent severe logical leaps.
- Provide a concise (under 100 words) neutral review detailing who is supported by the facts and where claims diverge from the source text.
- Do not take sides. Refer to sources specifically.`;
  }

  const mainPrompt = `
Topic of debate: "${session.topic}"
Current Round: ${round}

${memoryPrompt}
${historyPrompt}
Provide your response for the current turn:
`;

  try {
    let result = await generateContent({
      model,
      role,
      prompt: mainPrompt,
      roundIndex: round - 1,
      systemPrompt
    });

    // Handle Reflection & Self-Critique
    if (isSelfCritique) {
      broadcast(sessionId, { type: 'agent_status', agent: role, status: 'critiquing' });
      
      const critiquePrompt = `
You are the Self-Critique module for ${role.toUpperCase()}.
Review your drafted response for logical flow, rhetorical persuasiveness, and safety alignment.

Draft:
"${result.content}"

Critique this draft. Then, output your final polished version (retain the same general stance but optimize flow and clarity).
Ensure the final output is ONLY the polished response, without headings or side comments.
`;
      const critiqueResult = await generateContent({
        model,
        role,
        prompt: critiquePrompt,
        roundIndex: round - 1,
        systemPrompt: `You are an automated proofreader. Refine the text and output only the final polished paragraph.`
      });

      // Aggregate metrics
      result.content = critiqueResult.content;
      result.metrics.promptTokens += critiqueResult.metrics.promptTokens;
      result.metrics.completionTokens += critiqueResult.metrics.completionTokens;
      result.metrics.totalTokens += critiqueResult.metrics.totalTokens;
      result.metrics.costUsd += critiqueResult.metrics.costUsd;
      result.metrics.latencyMs += critiqueResult.metrics.latencyMs;
    }

    // Save claims to memory (excluding fact checker)
    if (role === 'debater' || role === 'challenger') {
      session.memory.addClaim(role, result.content.substring(0, 100) + '...', round);
    }

    const memorySnapshot = JSON.stringify(session.memory.getSnapshot());

    // Write message to Database
    const dbRes = await run(
      `INSERT INTO messages (session_id, round, sender, content, memory_snapshot, tokens_prompt, tokens_completion, latency_ms, cost_usd)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        round,
        role,
        result.content,
        memorySnapshot,
        result.metrics.promptTokens,
        result.metrics.completionTokens,
        result.metrics.latencyMs,
        result.metrics.costUsd
      ]
    );

    // Broadcast to UI
    broadcast(sessionId, {
      type: 'message_added',
      message: {
        id: dbRes.id,
        round,
        sender: role,
        content: result.content,
        memorySnapshot: session.memory.getSnapshot(),
        metrics: result.metrics
      }
    });

    // Run next step
    setTimeout(() => stepDebate(sessionId), 800);

  } catch (error) {
    console.error(`Orchestrator failed on ${role} turn:`, error);
    broadcast(sessionId, { type: 'agent_error', agent: role, message: error.message });
    session.status = 'failed';
    await run(`UPDATE debates SET status = 'failed' WHERE id = ?`, [sessionId]);
  }
}

/**
 * Execute Judge evaluation turn
 */
async function executeJudgeTurn(session, allMessages) {
  const sessionId = session.id;
  broadcast(sessionId, { type: 'agent_status', agent: 'judge', status: 'judging' });

  // Compile entire history for Judge review
  let historyText = '';
  allMessages.forEach(m => {
    historyText += `${m.sender.toUpperCase()} (Round ${m.round}): ${m.content}\n\n`;
  });

  const judgeSystemPrompt = `You are the Debate Judge.
Evaluate the arguments of DEBATER and CHALLENGER based on:
1. Rhetorical structure and persuasion.
2. Use of empirical evidence (RAG context).
3. Rebuttal effectiveness (how well they countered the other's claims).

You MUST output a clean, valid JSON object with the following structure (do not include markdown fences or any explanations outside the JSON):
{
  "winner": "Debater" | "Challenger",
  "scores": {
    "debater": { "rhetoric": number, "evidence": number, "rebuttals": number, "total": number },
    "challenger": { "rhetoric": number, "evidence": number, "rebuttals": number, "total": number }
  },
  "summary": "Detailed evaluation summary paragraph...",
  "recommendation": "Future guidance suggestion..."
}`;

  const judgePrompt = `
Topic of debate: "${session.topic}"
Rounds completed: ${session.maxRounds}

=== DEBATE CHAT LOGS ===
${historyText}
========================

Perform your evaluation and return the JSON verdict:
`;

  try {
    const result = await generateContent({
      model: session.config.judgeModel,
      role: 'judge',
      prompt: judgePrompt,
      isJson: true,
      systemPrompt: judgeSystemPrompt
    });

    let verdictObj;
    try {
      verdictObj = JSON.parse(result.content);
    } catch (e) {
      console.warn("Failed to parse judge JSON. Attempting regex extraction.");
      const match = result.content.match(/\{[\s\S]*\}/);
      if (match) {
        verdictObj = JSON.parse(match[0]);
      } else {
        throw new Error("Invalid Judge output format.");
      }
    }

    // Save verdict to DB
    await run(
      `UPDATE debates SET status = 'completed', verdict = ? WHERE id = ?`,
      [JSON.stringify(verdictObj), sessionId]
    );

    // Save Judge review message in message log for observability
    await run(
      `INSERT INTO messages (session_id, round, sender, content, tokens_prompt, tokens_completion, latency_ms, cost_usd)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        session.maxRounds,
        'judge',
        verdictObj.summary,
        result.metrics.promptTokens,
        result.metrics.completionTokens,
        result.metrics.latencyMs,
        result.metrics.costUsd
      ]
    );

    session.status = 'completed';
    
    broadcast(sessionId, {
      type: 'debate_completed',
      verdict: verdictObj,
      metrics: result.metrics
    });

    activeSessions.delete(sessionId); // Clean up active tracker

  } catch (error) {
    console.error('Orchestrator failed during Judge evaluation:', error);
    broadcast(sessionId, { type: 'agent_error', agent: 'judge', message: error.message });
    session.status = 'failed';
    await run(`UPDATE debates SET status = 'failed' WHERE id = ?`, [sessionId]);
  }
}

/**
 * Handle injection of human comment (HITL) and resume debate
 */
export async function injectHumanInput(sessionId, comment) {
  const session = activeSessions.get(sessionId);
  if (!session || session.status !== 'paused') {
    throw new Error('Debate is not in a paused state');
  }

  const round = session.currentRound;

  // Add comment to shared memory
  session.memory.addClaim('human', comment, round);
  const memorySnapshot = JSON.stringify(session.memory.getSnapshot());

  // Save to DB
  const dbRes = await run(
    `INSERT INTO messages (session_id, round, sender, content, memory_snapshot, tokens_prompt, tokens_completion, latency_ms, cost_usd)
     VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0.0)`,
    [sessionId, round, 'human', comment, memorySnapshot]
  );

  // Resume status
  session.status = 'active';
  await run(`UPDATE debates SET status = 'active' WHERE id = ?`, [sessionId]);

  // Broadcast the message added
  broadcast(sessionId, {
    type: 'message_added',
    message: {
      id: dbRes.id,
      round,
      sender: 'human',
      content: comment,
      memorySnapshot: session.memory.getSnapshot(),
      metrics: { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0.0, latencyMs: 0, model: 'human', isSimulation: false }
    }
  });

  // Advance to next round or call stepDebate
  if (session.currentRound < session.maxRounds) {
    session.currentRound += 1;
  } else {
    // If it was the last round, transition to judge turn on step
  }

  // Trigger next step asynchronously
  setTimeout(() => stepDebate(sessionId), 500);
}
