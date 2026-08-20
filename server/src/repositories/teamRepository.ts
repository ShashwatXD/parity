import { sqlite } from '../db/database.js';
import { createId } from '../lib/ids.js';
import type { TeamMessage, TeamState, TeamStatus } from '../runtime/teamTypes.js';

function parseState(row: Record<string, unknown>): TeamState {
  const artifacts = JSON.parse(String(row.artifacts_json ?? '{}')) as Record<string, unknown>;
  const messages = JSON.parse(String(row.messages_json ?? '[]')) as TeamMessage[];
  return {
    id: String(row.id),
    task: String(row.task),
    status: String(row.status) as TeamStatus,
    artifacts,
    messages,
    directorPlan: row.director_plan ? String(row.director_plan) : undefined,
    loop: Number(row.loop ?? 0),
    maxLoops: Number(row.max_loops ?? 1),
    sessionId: row.session_id ? String(row.session_id) : undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export const TeamRepository = {
  create(input: {
    task: string;
    sessionId?: string;
    maxLoops?: number;
  }): TeamState {
    const now = Date.now();
    const state: TeamState = {
      id: createId('team'),
      task: input.task,
      status: 'running',
      artifacts: {},
      messages: [],
      loop: 0,
      maxLoops: input.maxLoops ?? 1,
      sessionId: input.sessionId,
      createdAt: now,
      updatedAt: now,
    };
    sqlite
      .prepare(
        `INSERT INTO team_runs
         (id, task, status, artifacts_json, messages_json, director_plan, loop, max_loops, session_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        state.id,
        state.task,
        state.status,
        JSON.stringify(state.artifacts),
        JSON.stringify(state.messages),
        null,
        state.loop,
        state.maxLoops,
        state.sessionId ?? null,
        state.createdAt,
        state.updatedAt,
      );
    return state;
  },

  getById(id: string): TeamState | undefined {
    const row = sqlite
      .prepare(
        `SELECT id, task, status, artifacts_json, messages_json, director_plan, loop, max_loops, session_id, created_at, updated_at
         FROM team_runs WHERE id = ?`,
      )
      .get(id) as Record<string, unknown> | undefined;
    return row ? parseState(row) : undefined;
  },

  list(limit = 40): TeamState[] {
    return (
      sqlite
        .prepare(
          `SELECT id, task, status, artifacts_json, messages_json, director_plan, loop, max_loops, session_id, created_at, updated_at
           FROM team_runs ORDER BY created_at DESC LIMIT ?`,
        )
        .all(limit) as Record<string, unknown>[]
    ).map(parseState);
  },

  save(state: TeamState) {
    state.updatedAt = Date.now();
    sqlite
      .prepare(
        `UPDATE team_runs SET task = ?, status = ?, artifacts_json = ?, messages_json = ?, director_plan = ?,
         loop = ?, max_loops = ?, session_id = ?, updated_at = ? WHERE id = ?`,
      )
      .run(
        state.task,
        state.status,
        JSON.stringify(state.artifacts),
        JSON.stringify(state.messages),
        state.directorPlan ?? null,
        state.loop,
        state.maxLoops,
        state.sessionId ?? null,
        state.updatedAt,
        state.id,
      );
  },

  appendMessage(state: TeamState, message: Omit<TeamMessage, 'at'>) {
    state.messages.push({ ...message, at: Date.now() });
    this.save(state);
  },

  setArtifact(state: TeamState, key: string, value: unknown) {
    state.artifacts[key] = value;
    this.save(state);
  },
};
