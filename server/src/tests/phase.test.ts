import assert from 'node:assert/strict';
import test from 'node:test';
import { migrate, sqlite } from '../db/database.js';
import { createSession, addMessage, listMessages } from '../runtime/sessions.js';
import { recordEvent, metricsSummary, startRun } from '../observability/timeline.js';
import { createArtifact, listArtifacts } from '../runtime/artifacts.js';
import { listPlugins } from '../plugins/pluginSdk.js';

migrate();

test('session memory roundtrip', () => {
  const session = createSession({ title: 'test', provider: 'ollama', model: 'qwen2.5:3b' });
  addMessage({ sessionId: session.id, role: 'user', content: 'hello' });
  const messages = listMessages(session.id);
  assert.equal(messages.length >= 1, true);
  assert.equal(messages.at(-1)?.content, 'hello');
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
  });
  const metrics = metricsSummary();
  assert.ok(metrics.events >= 1);
  assert.ok(metrics.promptTokens >= 3);
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

test('plugin registry has core plugin', () => {
  const plugins = listPlugins();
  assert.ok(plugins.some((p: { name: string }) => p.name === 'parity-core-metrics'));
});

test('sqlite tables exist', () => {
  const tables = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
    .all() as Array<{ name: string }>;
  const names = tables.map((t) => t.name);
  for (const required of ['sessions', 'messages', 'workflows', 'execution_events', 'approvals']) {
    assert.ok(names.includes(required), `missing ${required}`);
  }
});
