import { sqlite } from '../db/database.js';
import { createId } from '../lib/ids.js';
import type { Workflow } from '../models.js';

export const WorkflowRepository = {
  create(input: { name: string; description?: string; graphJson: string }): Workflow {
    const row: Workflow = {
      id: createId('workflow'),
      name: input.name,
      description: input.description ?? '',
      graphJson: input.graphJson,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    sqlite
      .prepare(
        `INSERT INTO workflows (id, name, description, graph_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(row.id, row.name, row.description, row.graphJson, row.createdAt, row.updatedAt);
    return row;
  },

  list(): Workflow[] {
    return sqlite
      .prepare(
        `SELECT id, name, description, graph_json as graphJson, created_at as createdAt, updated_at as updatedAt
         FROM workflows ORDER BY updated_at DESC`,
      )
      .all() as Workflow[];
  },

  getById(id: string): Workflow | undefined {
    return sqlite
      .prepare(
        `SELECT id, name, description, graph_json as graphJson, created_at as createdAt, updated_at as updatedAt
         FROM workflows WHERE id = ?`,
      )
      .get(id) as Workflow | undefined;
  },

  createRun(workflowId: string, inputJson: string) {
    const id = createId('workflowRun');
    const now = Date.now();
    sqlite
      .prepare(
        `INSERT INTO workflow_runs (id, workflow_id, status, input_json, created_at, updated_at)
         VALUES (?, ?, 'running', ?, ?, ?)`,
      )
      .run(id, workflowId, inputJson, now, now);
    return id;
  },

  completeRun(id: string, outputJson: string) {
    sqlite
      .prepare(
        `UPDATE workflow_runs SET status = 'completed', output_json = ?, updated_at = ? WHERE id = ?`,
      )
      .run(outputJson, Date.now(), id);
  },

  failRun(id: string, error: string) {
    sqlite
      .prepare(
        `UPDATE workflow_runs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?`,
      )
      .run(error, Date.now(), id);
  },
};
