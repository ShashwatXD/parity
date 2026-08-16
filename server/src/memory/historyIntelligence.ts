import { sqlite } from '../db/database.js';
import type { MessageRole, Session } from '../models.js';
import { SessionRepository } from '../repositories/sessionRepository.js';

const DEFAULT_TITLES = new Set(['new chat', 'new conversation', 'untitled']);

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'do', 'for', 'from',
  'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'our', 'please', 'that',
  'the', 'this', 'to', 'we', 'what', 'when', 'where', 'which', 'who', 'why', 'with',
  'you', 'your',
]);

export type SessionIntelligence = Session & {
  messageCount: number;
  userMessageCount: number;
  preview: string;
  topics: string[];
  condensed: boolean;
  score?: number;
};

export type HistoryHit = {
  sessionId: string;
  sessionTitle: string;
  messageId: string;
  role: MessageRole | string;
  excerpt: string;
  score: number;
  createdAt: number;
};

export type HistoryGateDecision = {
  retrieve: boolean;
  query: string;
  reason: string;
};

type MessageRow = {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: number;
  sessionTitle: string;
};

export function tokenizeHistory(text: string): string[] {
  return (
    text
      .toLowerCase()
      .match(/[a-z0-9_]{2,}/g)
      ?.filter((w, i, arr) => arr.indexOf(w) === i && !STOPWORDS.has(w))
      .slice(0, 24) ?? []
  );
}

export function suggestSessionTitle(message: string): string {
  const cleaned = message.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'New conversation';
  const cut = cleaned.length > 56 ? `${cleaned.slice(0, 53).trimEnd()}…` : cleaned;
  return cut.charAt(0).toUpperCase() + cut.slice(1);
}

export function isDefaultSessionTitle(title: string): boolean {
  return DEFAULT_TITLES.has(title.trim().toLowerCase());
}

/** Rename untitled sessions from the first real user message. */
export function maybeAutoTitleSession(sessionId: string, userMessage: string): string | null {
  const session = SessionRepository.getById(sessionId);
  if (!session || !isDefaultSessionTitle(session.title)) return null;
  const title = suggestSessionTitle(userMessage);
  SessionRepository.updateTitle(sessionId, title);
  return title;
}

function scoreText(content: string, words: string[]): number {
  if (!words.length) return 0;
  const lower = content.toLowerCase();
  let score = 0;
  for (const w of words) {
    if (!lower.includes(w)) continue;
    score += 2;
    if (new RegExp(`\\b${escapeRegExp(w)}\\b`, 'i').test(content)) score += 2;
  }
  // Prefer denser hits in shorter messages
  if (score > 0) score += Math.min(3, Math.floor(120 / Math.max(40, content.length / 40)));
  return score;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function excerpt(content: string, max = 220): string {
  const flat = content.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1)}…`;
}

function extractTopics(texts: string[], limit = 4): string[] {
  const counts = new Map<string, number>();
  for (const text of texts) {
    for (const w of tokenizeHistory(text)) {
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([w]) => w);
}

/**
 * Enrich sessions with message stats, preview, and topic tags.
 * Optional `q` ranks by title + message content overlap.
 */
export function listSessionIntelligence(query?: string, limit = 80): SessionIntelligence[] {
  const sessions = SessionRepository.list();
  const words = query ? tokenizeHistory(query) : [];
  const qLower = query?.trim().toLowerCase() ?? '';

  const rows = sqlite
    .prepare(
      `SELECT session_id as sessionId, role, content, created_at as createdAt
       FROM messages
       WHERE role IN ('user', 'assistant', 'system')
       ORDER BY created_at ASC`,
    )
    .all() as Array<{ sessionId: string; role: string; content: string; createdAt: number }>;

  const bySession = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = bySession.get(row.sessionId) ?? [];
    list.push(row);
    bySession.set(row.sessionId, list);
  }

  const enriched: SessionIntelligence[] = sessions.map((s) => {
    const msgs = bySession.get(s.id) ?? [];
    const userMsgs = msgs.filter((m) => m.role === 'user');
    const assistantMsgs = msgs.filter((m) => m.role === 'assistant');
    const lastUser = userMsgs[userMsgs.length - 1];
    const lastAssistant = assistantMsgs[assistantMsgs.length - 1];
    const previewSource = lastUser?.content || lastAssistant?.content || '';
    const condensed = msgs.some(
      (m) => m.role === 'system' && m.content.startsWith('[Parity conversation summary]'),
    );
    const topics = extractTopics(
      [...userMsgs.slice(-4), ...assistantMsgs.slice(-2)].map((m) => m.content),
    );

    let score = 0;
    if (qLower) {
      if (s.title.toLowerCase().includes(qLower)) score += 8;
      if (s.id.toLowerCase().includes(qLower)) score += 4;
      for (const m of msgs) {
        if (m.role === 'system') continue;
        score += scoreText(m.content, words);
      }
      if (topics.some((t) => qLower.includes(t) || t.includes(qLower))) score += 3;
    }

    return {
      ...s,
      messageCount: msgs.length,
      userMessageCount: userMsgs.length,
      preview: excerpt(previewSource),
      topics,
      condensed,
      ...(qLower ? { score } : {}),
    };
  });

  if (!qLower) {
    return enriched.slice(0, limit);
  }

  return enriched
    .filter((s) => (s.score ?? 0) > 0 || s.title.toLowerCase().includes(qLower))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

/** Cross-session keyword search over user/assistant turns. */
export function searchConversationHistory(
  query: string,
  opts?: { limit?: number; excludeSessionId?: string },
): HistoryHit[] {
  const words = tokenizeHistory(query);
  if (!words.length) return [];

  const limit = opts?.limit ?? 8;
  const clauses = words.map(() => `lower(m.content) LIKE ?`).join(' OR ');
  const params = words.map((w) => `%${w}%`);

  const rows = sqlite
    .prepare(
      `SELECT m.id as id, m.session_id as sessionId, m.role as role, m.content as content,
              m.created_at as createdAt, s.title as sessionTitle
       FROM messages m
       JOIN sessions s ON s.id = m.session_id
       WHERE m.role IN ('user', 'assistant') AND (${clauses})
       ORDER BY m.created_at DESC
       LIMIT 200`,
    )
    .all(...params) as MessageRow[];

  const scored = rows
    .filter((r) => r.sessionId !== opts?.excludeSessionId)
    .map((r) => ({
      sessionId: r.sessionId,
      sessionTitle: r.sessionTitle,
      messageId: r.id,
      role: r.role,
      excerpt: excerpt(r.content, 280),
      score: scoreText(r.content, words),
      createdAt: r.createdAt,
    }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score || b.createdAt - a.createdAt);

  // Diversify: at most 2 hits per session
  const perSession = new Map<string, number>();
  const out: HistoryHit[] = [];
  for (const hit of scored) {
    const n = perSession.get(hit.sessionId) ?? 0;
    if (n >= 2) continue;
    perSession.set(hit.sessionId, n + 1);
    out.push(hit);
    if (out.length >= limit) break;
  }
  return out;
}

const HISTORY_FORCE =
  /\b(last time|previous (chat|conversation|session)|earlier we|we (discussed|talked)|before we|remind me what we|from (our|the) (last|previous)|in (our|the) (last|previous) (chat|conversation))\b/i;

const HISTORY_SKIP = /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|yep|nope)[\s!.?]*$/i;

/** Decide whether to pull cross-session conversation history into the prompt. */
export function shouldRetrieveHistory(message: string): HistoryGateDecision {
  const trimmed = message.trim();
  if (!trimmed) return { retrieve: false, query: '', reason: 'empty message' };
  if (HISTORY_SKIP.test(trimmed)) {
    return { retrieve: false, query: '', reason: 'skip — greeting / ack' };
  }
  if (HISTORY_FORCE.test(trimmed)) {
    return { retrieve: true, query: trimmed, reason: 'retrieve — references prior conversation' };
  }
  // Light heuristic: longer questions that look like continuity ("what did we decide…")
  if (/\b(decide[d]?|agreed|chose|picked|said|told you)\b/i.test(trimmed) && trimmed.length > 24) {
    return { retrieve: true, query: trimmed, reason: 'retrieve — likely continuity question' };
  }
  return { retrieve: false, query: '', reason: 'skip — no history cue' };
}

export function formatHistoryForPrompt(hits: HistoryHit[]): string {
  if (!hits.length) return '';
  const lines = hits.map((h) => {
    const when = new Date(h.createdAt).toISOString().slice(0, 10);
    return `- [${h.sessionTitle} · ${h.role} · ${when}] ${h.excerpt}`;
  });
  return ['## Prior conversation history (retrieved)', ...lines].join('\n');
}

export function gatedRetrieveHistory(
  message: string,
  opts?: { excludeSessionId?: string; topK?: number },
): {
  gate: HistoryGateDecision;
  hits: HistoryHit[];
  promptBlock: string;
} {
  const gate = shouldRetrieveHistory(message);
  if (!gate.retrieve) {
    return { gate, hits: [], promptBlock: '' };
  }
  const hits = searchConversationHistory(gate.query || message, {
    limit: opts?.topK ?? 6,
    excludeSessionId: opts?.excludeSessionId,
  });
  return { gate, hits, promptBlock: formatHistoryForPrompt(hits) };
}
