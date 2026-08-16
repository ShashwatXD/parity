import assert from 'node:assert/strict';
import test from 'node:test';
import { migrate } from '../db/database.js';
import {
  listSessionIntelligence,
  maybeAutoTitleSession,
  searchConversationHistory,
  shouldRetrieveHistory,
  suggestSessionTitle,
} from '../memory/historyIntelligence.js';
import { addMessage, createSession, deleteSession } from '../runtime/sessions.js';

migrate();

test('suggestSessionTitle truncates and capitalizes', () => {
  assert.equal(suggestSessionTitle('fix the dark mode preference'), 'Fix the dark mode preference');
  const long = 'a'.repeat(80);
  assert.ok(suggestSessionTitle(long).endsWith('…'));
});

test('history gate retrieves continuity cues and skips greetings', () => {
  assert.equal(shouldRetrieveHistory('hi').retrieve, false);
  assert.equal(shouldRetrieveHistory('what did we decide about the RAG pipeline last time?').retrieve, true);
  assert.equal(shouldRetrieveHistory('remind me what we discussed about MCP').retrieve, true);
});

test('session intelligence + cross-session search', () => {
  const a = createSession({ title: 'New conversation' });
  const b = createSession({ title: 'New chat' });

  addMessage({ sessionId: a.id, role: 'user', content: 'We decided to use Voyage embeddings for code RAG' });
  addMessage({
    sessionId: a.id,
    role: 'assistant',
    content: 'Agreed — Voyage voyage-code-3 keeps chat and embeddings separate.',
  });
  addMessage({ sessionId: b.id, role: 'user', content: 'How do I connect Playwright MCP?' });

  const titled = maybeAutoTitleSession(b.id, 'How do I connect Playwright MCP?');
  assert.ok(titled);
  assert.match(titled!, /Playwright/i);

  // a stays default until first auto-title call
  const titledA = maybeAutoTitleSession(a.id, 'We decided to use Voyage embeddings for code RAG');
  assert.ok(titledA);

  const list = listSessionIntelligence('Voyage embeddings');
  assert.ok(list.some((s) => s.id === a.id && (s.score ?? 0) > 0));
  const intelA = list.find((s) => s.id === a.id);
  assert.ok((intelA?.messageCount ?? 0) >= 2);
  assert.ok(intelA?.preview);

  const hits = searchConversationHistory('Voyage embeddings RAG', { excludeSessionId: b.id });
  assert.ok(hits.some((h) => h.sessionId === a.id));
  assert.ok(hits.every((h) => h.sessionId !== b.id));

  deleteSession(a.id);
  deleteSession(b.id);
});
