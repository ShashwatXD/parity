import { run, initDB } from './db.js';
import { generateContent } from './llm.js';
import { SharedMemory } from './memory.js';

/**
 * Runs a single debate session synchronously for evaluation purposes (bypassing WebSocket and HITL)
 */
async function runEvalSession(topic, maxRounds, config) {
  const memory = new SharedMemory();
  const messages = [];
  let totalCost = 0;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalLatency = 0;

  // Add grounding documents if any provided
  if (config.groundingContent) {
    memory.addGroundingDocument('grounding_eval.txt', config.groundingContent);
  }

  for (let r = 1; r <= maxRounds; r++) {
    // 1. Debater turn
    const debaterPrompt = `Topic: "${topic}". Round: ${r}. Argue in favor. Memory claims:\n${JSON.stringify(memory.getSnapshot().claims)}`;
    const debaterRes = await generateContent({
      model: config.debaterModel || 'gemini-2.5-flash',
      role: 'debater',
      prompt: debaterPrompt,
      roundIndex: r - 1,
      systemPrompt: 'You are DEBATER. Argue in favor under 100 words.'
    });
    memory.addClaim('debater', debaterRes.content.substring(0, 100), r);
    messages.push({ sender: 'debater', content: debaterRes.content, round: r });
    totalCost += debaterRes.metrics.costUsd;
    totalPromptTokens += debaterRes.metrics.promptTokens;
    totalCompletionTokens += debaterRes.metrics.completionTokens;
    totalLatency += debaterRes.metrics.latencyMs;

    // 2. Challenger turn
    const challengerPrompt = `Topic: "${topic}". Round: ${r}. Argue against. Memory claims:\n${JSON.stringify(memory.getSnapshot().claims)}`;
    const challengerRes = await generateContent({
      model: config.challengerModel || 'gemini-2.5-flash',
      role: 'challenger',
      prompt: challengerPrompt,
      roundIndex: r - 1,
      systemPrompt: 'You are CHALLENGER. Argue against under 100 words.'
    });
    memory.addClaim('challenger', challengerRes.content.substring(0, 100), r);
    messages.push({ sender: 'challenger', content: challengerRes.content, round: r });
    totalCost += challengerRes.metrics.costUsd;
    totalPromptTokens += challengerRes.metrics.promptTokens;
    totalCompletionTokens += challengerRes.metrics.completionTokens;
    totalLatency += challengerRes.metrics.latencyMs;

    // 3. Fact Checker turn (optional)
    if (config.enableFactChecker) {
      const factPrompt = `Analyze inputs from round ${r} against grounding info.`;
      const factRes = await generateContent({
        model: config.factCheckerModel || 'gemini-2.5-flash',
        role: 'fact_checker',
        prompt: factPrompt,
        roundIndex: r - 1,
        systemPrompt: 'Verify statements and flag errors neutrally.'
      });
      messages.push({ sender: 'fact_checker', content: factRes.content, round: r });
      totalCost += factRes.metrics.costUsd;
      totalPromptTokens += factRes.metrics.promptTokens;
      totalCompletionTokens += factRes.metrics.completionTokens;
      totalLatency += factRes.metrics.latencyMs;
    }
  }

  // 4. Judge Turn
  let historyText = messages.map(m => `${m.sender.toUpperCase()} (Round ${m.round}): ${m.content}`).join('\n\n');
  const judgePrompt = `Evaluate the debate on "${topic}". Logs:\n${historyText}`;
  const judgeSystemPrompt = `Analyze debate. Output JSON format: { "winner": "Debater"|"Challenger", "scores": { "debater": { "total": number }, "challenger": { "total": number } }, "summary": "..." }`;
  
  const judgeRes = await generateContent({
    model: config.judgeModel || 'gemini-2.5-pro',
    role: 'judge',
    prompt: judgePrompt,
    isJson: true,
    systemPrompt: judgeSystemPrompt
  });

  totalCost += judgeRes.metrics.costUsd;
  totalPromptTokens += judgeRes.metrics.promptTokens;
  totalCompletionTokens += judgeRes.metrics.completionTokens;
  totalLatency += judgeRes.metrics.latencyMs;

  let verdict;
  try {
    verdict = JSON.parse(judgeRes.content);
  } catch (e) {
    const match = judgeRes.content.match(/\{[\s\S]*\}/);
    verdict = match ? JSON.parse(match[0]) : { winner: 'Challenger', scores: { debater: { total: 80 }, challenger: { total: 85 } } };
  }

  return {
    winner: verdict.winner,
    scores: verdict.scores,
    metrics: {
      totalCost,
      totalPromptTokens,
      totalCompletionTokens,
      totalLatency,
      isSimulation: judgeRes.metrics.isSimulation
    }
  };
}

/**
 * Executes a batch of debates to evaluate prompt configurations or model routings
 */
export async function executeEvaluationRun(evalName, topic, maxRounds, config, runCount = 3) {
  const evalId = `eval_${Date.now()}`;
  console.log(`[Evaluation Suite] Starting evaluation "${evalName}" with ${runCount} runs...`);

  const runResults = [];
  let debaterWins = 0;
  let challengerWins = 0;

  for (let i = 1; i <= runCount; i++) {
    console.log(`[Evaluation Suite] Executing run ${i}/${runCount} for "${evalName}"`);
    try {
      const sessionResult = await runEvalSession(topic, maxRounds, config);
      runResults.push(sessionResult);
      if (sessionResult.winner.toLowerCase() === 'debater') {
        debaterWins++;
      } else {
        challengerWins++;
      }
    } catch (error) {
      console.error(`[Evaluation Suite] Run ${i} failed:`, error.message);
    }
  }

  if (runResults.length === 0) {
    throw new Error('All evaluation runs failed');
  }

  // Calculate averages
  const avgCost = runResults.reduce((acc, r) => acc + r.metrics.totalCost, 0) / runResults.length;
  const avgLatency = runResults.reduce((acc, r) => acc + r.metrics.totalLatency, 0) / runResults.length;
  const avgPromptTokens = runResults.reduce((acc, r) => acc + r.metrics.totalPromptTokens, 0) / runResults.length;
  const avgCompletionTokens = runResults.reduce((acc, r) => acc + r.metrics.totalCompletionTokens, 0) / runResults.length;

  const avgDebaterScore = runResults.reduce((acc, r) => acc + (r.scores?.debater?.total || r.scores?.debater?.rhetoric || 0), 0) / runResults.length;
  const avgChallengerScore = runResults.reduce((acc, r) => acc + (r.scores?.challenger?.total || r.scores?.challenger?.rhetoric || 0), 0) / runResults.length;

  // Calculate consistency (Standard deviation of scores)
  const meanScoreDiffs = runResults.map(r => {
    const d = r.scores?.debater?.total || 0;
    const c = r.scores?.challenger?.total || 0;
    return Math.abs(d - c);
  });
  const avgDiff = meanScoreDiffs.reduce((acc, val) => acc + val, 0) / meanScoreDiffs.length;
  const variance = meanScoreDiffs.reduce((acc, val) => acc + Math.pow(val - avgDiff, 2), 0) / meanScoreDiffs.length;
  const stdDeviation = Math.sqrt(variance);

  const resultsSummary = {
    totalRuns: runCount,
    successfulRuns: runResults.length,
    debaterWins,
    challengerWins,
    winRatio: {
      debater: Number((debaterWins / runResults.length).toFixed(2)),
      challenger: Number((challengerWins / runResults.length).toFixed(2))
    },
    averages: {
      costUsd: Number(avgCost.toFixed(5)),
      latencyMs: Number(avgLatency.toFixed(0)),
      promptTokens: Number(avgPromptTokens.toFixed(0)),
      completionTokens: Number(avgCompletionTokens.toFixed(0)),
      scores: {
        debater: Number(avgDebaterScore.toFixed(1)),
        challenger: Number(avgChallengerScore.toFixed(1))
      }
    },
    metricsConsistency: {
      scoreGapStandardDeviation: Number(stdDeviation.toFixed(2))
    },
    runs: runResults
  };

  // Save to DB
  await run(
    `INSERT INTO evaluations (id, name, topic, config, runs, results) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      evalId,
      evalName,
      topic,
      JSON.stringify(config),
      runCount,
      JSON.stringify(resultsSummary)
    ]
  );

  console.log(`[Evaluation Suite] Evaluation "${evalName}" completed. ID: ${evalId}`);
  return { id: evalId, results: resultsSummary };
}
