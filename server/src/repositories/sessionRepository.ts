import { DEFAULT_MODEL, DEFAULT_PROVIDER } from '../constants.js';
import { sqlite } from '../db/database.js';
import { createId } from '../lib/ids.js';
import type { Message, MessageRole, ProviderId, Session } from '../models.js';

export const SessionRepository = {
  create(input?: { title?: string; provider?: ProviderId; model?: string }): Session {
    const row: Session = {
      id: createId('session'),
      title: input?.title ?? 'New chat',
      provider: input?.provider ?? DEFAULT_PROVIDER,
      model: input?.model ?? DEFAULT_MODEL,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    sqlite
      .prepare(
        `INSERT INTO sessions (id, title, provider, model, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(row.id, row.title, row.provider, row.model, row.createdAt, row.updatedAt);
    return row;
  },

  list(query?: string): Session[] {
    const rows = sqlite
      .prepare(
        `SELECT id, title, provider, model, created_at as createdAt, updated_at as updatedAt
         FROM sessions ORDER BY updated_at DESC`,
      )
      .all() as Session[];
    if (!query) return rows;
    const q = query.toLowerCase();
    return rows.filter((s) => s.title.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
  },

  getById(id: string): Session | undefined {
    return sqlite
      .prepare(
        `SELECT id, title, provider, model, created_at as createdAt, updated_at as updatedAt
         FROM sessions WHERE id = ?`,
      )
      .get(id) as Session | undefined;
  },

  touch(id: string) {
    sqlite.prepare(`UPDATE sessions SET updated_at = ? WHERE id = ?`).run(Date.now(), id);
  },

  delete(id: string): boolean {
    const result = sqlite.prepare(`DELETE FROM sessions WHERE id = ?`).run(id);
    return Number(result.changes) > 0;
  },
};

export const MessageRepository = {
  listBySession(sessionId: string): Message[] {
    return sqlite
      .prepare(
        `SELECT id, session_id as sessionId, role, content,
                tool_name as toolName, tool_call_id as toolCallId,
                tokens_prompt as tokensPrompt, tokens_completion as tokensCompletion,
                latency_ms as latencyMs, cost_usd as costUsd, created_at as createdAt
         FROM messages WHERE session_id = ? ORDER BY created_at ASC`,
      )
      .all(sessionId) as Message[];
  },

  create(input: {
    sessionId: string;
    role: MessageRole;
    content: string;
    toolName?: string;
    toolCallId?: string;
    tokensPrompt?: number;
    tokensCompletion?: number;
    latencyMs?: number;
    costUsd?: number;
    createdAt?: number;
  }): Message {
    const row: Message = {
      id: createId('message'),
      sessionId: input.sessionId,
      role: input.role,
      content: input.content,
      toolName: input.toolName ?? null,
      toolCallId: input.toolCallId ?? null,
      tokensPrompt: input.tokensPrompt ?? 0,
      tokensCompletion: input.tokensCompletion ?? 0,
      latencyMs: input.latencyMs ?? 0,
      costUsd: input.costUsd ?? 0,
      createdAt: input.createdAt ?? Date.now(),
    };
    sqlite
      .prepare(
        `INSERT INTO messages (
           id, session_id, role, content, tool_name, tool_call_id,
           tokens_prompt, tokens_completion, latency_ms, cost_usd, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.sessionId,
        row.role,
        row.content,
        row.toolName,
        row.toolCallId,
        row.tokensPrompt,
        row.tokensCompletion,
        row.latencyMs,
        row.costUsd,
        row.createdAt,
      );
    SessionRepository.touch(input.sessionId);
    return row;
  },

  deleteMany(ids: string[]): number {
    if (!ids.length) return 0;
    const placeholders = ids.map(() => '?').join(', ');
    const result = sqlite
      .prepare(`DELETE FROM messages WHERE id IN (${placeholders})`)
      .run(...ids);
    return Number(result.changes);
  },
};
