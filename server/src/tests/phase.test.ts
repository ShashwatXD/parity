import assert from 'node:assert/strict';
import test from 'node:test';
import { migrate, sqlite } from '../db/database.js';
import { createSession, addMessage, listMessages, deleteSession, getSession } from '../runtime/sessions.js';
import { recordEvent, metricsSummary, startRun } from '../observability/timeline.js';
import { estimateCostUsd } from '../observability/cost.js';
import { createArtifact, listArtifacts } from '../runtime/artifacts.js';
import { listPlugins } from '../plugins/pluginSdk.js';
import { createWorkflow, listWorkflows } from '../runtime/workflows.js';

migrate();

test('session memory roundtrip', () => {
  const session = createSession({ title: 'test', provider: 'ollama', model: 'qwen2.5:3b' });
  addMessage({ sessionId: session.id, role: 'user', content: 'hello' });
  const messages = listMessages(session.id);
  assert.equal(messages.length >= 1, true);
  assert.equal(messages.at(-1)?.content, 'hello');
});

test('session delete cascades messages', () => {
  const session = createSession({ title: 'delete-me' });
  addMessage({ sessionId: session.id, role: 'user', content: 'bye' });
  assert.equal(deleteSession(session.id), true);
  assert.equal(getSession(session.id), undefined);
  assert.equal(listMessages(session.id).length, 0);
});

test('tool turns persist in session history', () => {
  const session = createSession({ title: 'tools' });
  addMessage({
    sessionId: session.id,
    role: 'tool',
    content: '{"ok":true}',
    toolName: 'Filesystem.list_directory',
    latencyMs: 8,
  });
  const tools = listMessages(session.id).filter((m) => m.role === 'tool');
  assert.equal(tools.length, 1);
  assert.equal(tools[0]?.toolName, 'Filesystem.list_directory');
});

test('observability events accumulate metrics', () => {
  const { runId } = startRun();
  recordEvent({
    runId,
    kind: 'tool_call',
    label: 'demo.tool',
    latencyMs: 12,
    tokensPrompt: 3,
    tokensCompletion: 5,
    costUsd: 0.0001,
  });
  const metrics = metricsSummary();
  assert.ok(metrics.events >= 1);
  assert.ok(metrics.promptTokens >= 3);
  assert.ok(Number(metrics.costUsd) >= 0.0001);
});

test('cost estimator prices cloud models and zeros ollama', () => {
  const cloud = estimateCostUsd({
    provider: 'openai',
    model: 'gpt-4o-mini',
    promptTokens: 1_000_000,
    completionTokens: 1_000_000,
  });
  assert.ok(cloud > 0);
  const local = estimateCostUsd({
    provider: 'ollama',
    model: 'qwen2.5:3b',
    promptTokens: 1_000_000,
    completionTokens: 1_000_000,
  });
  assert.equal(local, 0);
});

test('artifact generation', () => {
  const art = createArtifact({
    title: 'Report',
    kind: 'markdown',
    content: '# hi',
  });
  const all = listArtifacts() as Array<{ id: string }>;
  assert.ok(all.some((a) => a.id === art.id));
});

test('workflow graph with retry + condition metadata persists', () => {
  const wf = createWorkflow({
    name: 'retry-demo',
    description: 'interview-level orchestration metadata',
    graph: {
      steps: [
        {
          id: 'step1',
          type: 'tool',
          connectionId: 'mcp_demo',
          toolName: 'list_directory',
          args: { path: '/tmp' },
          maxRetries: 2,
        },
        {
          id: 'step2',
          type: 'artifact',
          title: 'Listing',
          kind: 'markdown',
          fromStepId: 'step1',
        },
      ],
    },
  });
  const listed = listWorkflows() as Array<{ id: string; graphJson: string }>;
  const found = listed.find((w) => w.id === wf.id);
  assert.ok(found);
  const graph = JSON.parse(found!.graphJson) as { steps: Array<{ maxRetries?: number }> };
  assert.equal(graph.steps[0]?.maxRetries, 2);
});

test('plugin registry has core plugin', () => {
  const plugins = listPlugins();
  assert.ok(plugins.some((p: { name: string }) => p.name === 'parity-core-metrics'));
});

test('sqlite tables exist', () => {
  const tables = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
    .all() as Array<{ name: string }>;
  const names = tables.map((t) => t.name);
  for (const required of [
    'sessions',
    'messages',
    'workflows',
    'execution_events',
    'approvals',
    'user_memories',
    'agent_defs',
    'team_runs',
  ]) {
    assert.ok(names.includes(required), `missing ${required}`);
  }
});
