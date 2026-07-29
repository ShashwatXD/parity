import { sqlite } from '../db/database.js';
import { createId } from '../lib/ids.js';
import type { Approval, ApprovalStatus } from '../models.js';

export const ApprovalRepository = {
  createPending(input: { runId: string; toolName: string; args: Record<string, unknown> }): string {
    const id = createId('approval');
    sqlite
      .prepare(
        `INSERT INTO approvals (id, run_id, tool_name, args_json, status, created_at)
         VALUES (?, ?, ?, ?, 'pending', ?)`,
      )
      .run(id, input.runId, input.toolName, JSON.stringify(input.args), Date.now());
    return id;
  },

  getById(id: string): Approval | undefined {
    return sqlite
      .prepare(
        `SELECT id, run_id as runId, tool_name as toolName, args_json as argsJson, status,
                decision_note as decisionNote, created_at as createdAt, resolved_at as resolvedAt
         FROM approvals WHERE id = ?`,
      )
      .get(id) as Approval | undefined;
  },

  list(status?: string): Approval[] {
    if (status) {
      return sqlite
        .prepare(
          `SELECT id, run_id as runId, tool_name as toolName, args_json as argsJson, status,
                  decision_note as decisionNote, created_at as createdAt, resolved_at as resolvedAt
           FROM approvals WHERE status = ? ORDER BY created_at DESC`,
        )
        .all(status) as Approval[];
    }
    return sqlite
      .prepare(
        `SELECT id, run_id as runId, tool_name as toolName, args_json as argsJson, status,
                decision_note as decisionNote, created_at as createdAt, resolved_at as resolvedAt
         FROM approvals ORDER BY created_at DESC LIMIT 100`,
      )
      .all() as Approval[];
  },

  resolve(id: string, status: Exclude<ApprovalStatus, 'pending'>, note?: string) {
    sqlite
      .prepare(
        `UPDATE approvals SET status = ?, decision_note = ?, resolved_at = ? WHERE id = ?`,
      )
      .run(status, note ?? null, Date.now(), id);
    return { id, status };
  },
};
