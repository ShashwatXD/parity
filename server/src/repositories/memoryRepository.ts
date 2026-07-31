import { sqlite } from '../db/database.js';
import { createId } from '../lib/ids.js';
import type { MemoryKind, UserMemory } from '../models.js';

function rowToMemory(r: Record<string, unknown>): UserMemory {
  return {
    id: String(r.id),
    kind: (r.kind as MemoryKind) || 'fact',
    subject: String(r.subject ?? ''),
    content: String(r.content ?? ''),
    happenedAt: r.happened_at == null ? null : String(r.happened_at),
    source: String(r.source ?? 'user'),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

const SELECT = `SELECT id, kind, subject, content, happened_at, source, created_at, updated_at
     FROM user_memories`;

export const MemoryRepository = {
  list(kind?: MemoryKind, limit = 200): UserMemory[] {
    if (kind) {
      return (
        sqlite
          .prepare(`${SELECT} WHERE kind = ? ORDER BY updated_at DESC LIMIT ?`)
          .all(kind, limit) as Record<string, unknown>[]
      ).map(rowToMemory);
    }
    return (
      sqlite.prepare(`${SELECT} ORDER BY updated_at DESC LIMIT ?`).all(limit) as Record<
        string,
        unknown
      >[]
    ).map(rowToMemory);
  },

  get(id: string): UserMemory | undefined {
    const row = sqlite.prepare(`${SELECT} WHERE id = ?`).get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? rowToMemory(row) : undefined;
  },

  add(input: {
    kind?: MemoryKind;
    subject?: string;
    content: string;
    happenedAt?: string | null;
    source?: string;
  }): UserMemory {
    const now = Date.now();
    const row: UserMemory = {
      id: createId('memory'),
      kind: input.kind ?? 'fact',
      subject: (input.subject ?? '').trim().toLowerCase(),
      content: input.content.trim(),
      happenedAt: input.happenedAt ?? null,
      source: input.source ?? 'user',
      createdAt: now,
      updatedAt: now,
    };
    sqlite
      .prepare(
        `INSERT INTO user_memories
          (id, kind, subject, content, happened_at, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.kind,
        row.subject,
        row.content,
        row.happenedAt,
        row.source,
        row.createdAt,
        row.updatedAt,
      );
    return row;
  },

  update(
    id: string,
    patch: { subject?: string; content?: string; happenedAt?: string | null; kind?: MemoryKind },
  ): UserMemory | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;
    const next: UserMemory = {
      ...existing,
      subject:
        patch.subject !== undefined ? patch.subject.trim().toLowerCase() : existing.subject,
      content: patch.content !== undefined ? patch.content.trim() : existing.content,
      happenedAt: patch.happenedAt !== undefined ? patch.happenedAt : existing.happenedAt,
      kind: patch.kind ?? existing.kind,
      updatedAt: Date.now(),
    };
    sqlite
      .prepare(
        `UPDATE user_memories
         SET subject = ?, content = ?, happened_at = ?, kind = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(next.subject, next.content, next.happenedAt, next.kind, next.updatedAt, id);
    return next;
  },

  delete(id: string): boolean {
    const result = sqlite.prepare(`DELETE FROM user_memories WHERE id = ?`).run(id);
    return Number(result.changes) > 0;
  },

  /** Keyword search over subject + content (BM25-ish via simple token OR). */
  search(query: string, topK = 6): UserMemory[] {
    const words = query
      .toLowerCase()
      .match(/[a-z0-9]{2,}/g)
      ?.filter((w, i, arr) => arr.indexOf(w) === i)
      .slice(0, 12);
    if (!words?.length) {
      return this.list(undefined, topK);
    }

    const clauses = words.map(() => `(lower(subject) LIKE ? OR lower(content) LIKE ?)`).join(' OR ');
    const params = words.flatMap((w) => [`%${w}%`, `%${w}%`]);
    const rows = sqlite
      .prepare(`${SELECT} WHERE ${clauses} ORDER BY updated_at DESC LIMIT ?`)
      .all(...params, topK) as Record<string, unknown>[];
    return rows.map(rowToMemory);
  },

  count(): number {
    const row = sqlite.prepare(`SELECT COUNT(*) as c FROM user_memories`).get() as { c: number };
    return Number(row.c);
  },
};
