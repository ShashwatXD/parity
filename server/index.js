import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { parse } from 'url';
import { initDB, query, get } from './db.js';
import { createDebateSession, activeSessions, stepDebate, injectHumanInput } from './orchestrator.js';
import { executeEvaluationRun } from './evaluator.js';

const app = express();
const port = process.env.PORT || 5005;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// REST API Endpoints

// 1. Get active and historical debates
app.get('/api/debates', async (req, res) => {
  try {
    const rows = await query(`SELECT * FROM debates ORDER BY created_at DESC`);
    const parsed = rows.map(r => ({
      ...r,
      config: r.config ? JSON.parse(r.config) : {},
      verdict: r.verdict ? JSON.parse(r.verdict) : null
    }));
    res.json(parsed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Start a new debate
app.post('/api/debate', async (req, res) => {
  const { topic, maxRounds, config } = req.body;
  if (!topic || !maxRounds) {
    return res.status(400).json({ error: 'Missing topic or maxRounds parameter' });
  }
  try {
    const sessionId = await createDebateSession(topic, parseInt(maxRounds), config);
    
    // Start debate execution loop asynchronously
    setTimeout(() => stepDebate(sessionId), 1000);

    res.json({ sessionId, status: 'started' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Inject human feedback (Human in the Loop)
app.post('/api/debate/:id/inject', async (req, res) => {
  const sessionId = req.params.id;
  const { comment } = req.body;
  if (!comment) {
    return res.status(400).json({ error: 'Missing comment parameter' });
  }
  try {
    await injectHumanInput(sessionId, comment);
    res.json({ status: 'resumed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Get a single debate session detail (history of messages)
app.get('/api/debate/:id', async (req, res) => {
  const sessionId = req.params.id;
  try {
    const debate = await get(`SELECT * FROM debates WHERE id = ?`, [sessionId]);
    if (!debate) {
      return res.status(404).json({ error: 'Debate not found' });
    }
    const messages = await query(
      `SELECT * FROM messages WHERE session_id = ? ORDER BY id ASC`,
      [sessionId]
    );

    const parsedMessages = messages.map(m => ({
      ...m,
      memorySnapshot: m.memory_snapshot ? JSON.parse(m.memory_snapshot) : null,
      metrics: {
        promptTokens: m.tokens_prompt,
        completionTokens: m.tokens_completion,
        totalTokens: m.tokens_prompt + m.tokens_completion,
        costUsd: m.cost_usd,
        latencyMs: m.latency_ms,
        model: 'gemini'
      }
    }));

    res.json({
      ...debate,
      config: debate.config ? JSON.parse(debate.config) : {},
      verdict: debate.verdict ? JSON.parse(debate.verdict) : null,
      messages: parsedMessages
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Add grounding text document directly to session (RAG)
app.post('/api/debate/:id/grounding', (req, res) => {
  const sessionId = req.params.id;
  const { filename, text } = req.body;
  if (!text || !filename) {
    return res.status(400).json({ error: 'Missing filename or text' });
  }

  const session = activeSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Active session not found. RAG documents must be uploaded during active sessions.' });
  }

  try {
    session.memory.addGroundingDocument(filename, text);
    res.json({ status: 'indexed', chunks: session.memory.ragIndex.chunks.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Get all evaluations
app.get('/api/evaluations', async (req, res) => {
  try {
    const rows = await query(`SELECT * FROM evaluations ORDER BY created_at DESC`);
    const parsed = rows.map(r => ({
      ...r,
      config: JSON.parse(r.config),
      results: JSON.parse(r.results)
    }));
    res.json(parsed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Run a new evaluation
app.post('/api/evaluations', async (req, res) => {
  const { name, topic, maxRounds, config, runs } = req.body;
  if (!name || !topic || !maxRounds || !runs) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    // Run evaluation in the background since it might take a bit
    executeEvaluationRun(name, topic, parseInt(maxRounds), config, parseInt(runs))
      .catch(err => console.error(`Background evaluation failed: ${err.message}`));

    res.json({ status: 'evaluation_started' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create Servers
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Upgrade HTTP to WS connection
server.on('upgrade', (request, socket, head) => {
  const { pathname, query: queryStr } = parse(request.url, true);

  if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// WS Connection Listener
wss.on('connection', (ws, request) => {
  const { query: queryParams } = parse(request.url, true);
  const sessionId = queryParams.sessionId;

  if (!sessionId) {
    ws.close(4000, 'Missing sessionId');
    return;
  }

  const session = activeSessions.get(sessionId);
  if (!session) {
    ws.close(4004, 'Session not found or finished');
    return;
  }

  // Subscribe connection to the session
  session.connections.add(ws);
  console.log(`[WS] Client subscribed to debate session: ${sessionId}`);

  ws.on('close', () => {
    if (activeSessions.has(sessionId)) {
      activeSessions.get(sessionId).connections.delete(ws);
      console.log(`[WS] Client unsubscribed from debate session: ${sessionId}`);
    }
  });

  // Listen for client messages (e.g. live commands)
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'human_inject') {
        await injectHumanInput(sessionId, data.comment);
      }
    } catch (err) {
      console.error('[WS] Failed to parse client message:', err);
    }
  });
});

// Start listening
initDB().then(() => {
  server.listen(port, () => {
    console.log(`Parity Server running on http://localhost:${port}`);
  });
});
