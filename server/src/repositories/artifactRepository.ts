import { sqlite } from '../db/database.js';
import { createId } from '../lib/ids.js';
import type { Artifact, ArtifactKind } from '../models.js';

export const ArtifactRepository = {
  create(input: {
    runId?: string;
    sessionId?: string;
    title: string;
    kind: ArtifactKind;
    content: string;
  }): Artifact {
    const row: Artifact = {
      id: createId('artifact'),
      runId: input.runId ?? null,
      sessionId: input.sessionId ?? null,
      title: input.title,
      kind: input.kind,
      content: input.content,
      createdAt: Date.now(),
    };
    sqlite
      .prepare(
        `INSERT INTO artifacts (id, run_id, session_id, title, kind, content, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(row.id, row.runId, row.sessionId, row.title, row.kind, row.content, row.createdAt);
    return row;
  },

  list(): Artifact[] {
    return sqlite
      .prepare(
        `SELECT id, run_id as runId, session_id as sessionId, title, kind, content, created_at as createdAt
         FROM artifacts ORDER BY created_at DESC LIMIT 100`,
      )
      .all() as Artifact[];
  },
};
