import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildContextSnapshot,
  estimateTokens,
  MODEL_CONTEXT_LIMITS,
} from '../runtime/contextWindow.js';
import { addMessage, createSession, deleteSession } from '../runtime/sessions.js';
import { migrate } from '../db/database.js';

migrate();

test('estimateTokens scales with content length', () => {
  assert.equal(estimateTokens(''), 0);
  assert.ok(estimateTokens('hello world') > 0);
  assert.ok(estimateTokens('x'.repeat(3500)) >= 900);
});

test('context snapshot reports usage against model budget', () => {
  const session = createSession({ title: 'ctx', provider: 'ollama', model: 'qwen2.5:3b' });
  try {
    addMessage({ sessionId: session.id, role: 'user', content: 'a'.repeat(4000) });
    addMessage({ sessionId: session.id, role: 'assistant', content: 'b'.repeat(4000) });
    const snap = buildContextSnapshot({
      sessionId: session.id,
      provider: 'ollama',
      model: 'qwen2.5:3b',
    });
    assert.equal(snap.limitTokens, MODEL_CONTEXT_LIMITS['qwen2.5:3b']);
    assert.ok(snap.usedTokens > 1000);
    assert.ok(snap.percentUsed > 0);
    assert.equal(snap.messageCount, 2);
  } finally {
    deleteSession(session.id);
  }
});
