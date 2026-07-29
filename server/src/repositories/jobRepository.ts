import { sqlite } from '../db/database.js';
import { createId } from '../lib/ids.js';
import type { BackgroundJob } from '../models.js';

export const JobRepository = {
  enqueue(kind: string, payload: unknown): BackgroundJob {
    const row: BackgroundJob = {
      id: createId('job'),
      kind,
      payloadJson: JSON.stringify(payload),
      status: 'queued',
      resultJson: null,
      error: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    sqlite
      .prepare(
        `INSERT INTO background_jobs (id, kind, payload_json, status, created_at, updated_at)
         VALUES (?, ?, ?, 'queued', ?, ?)`,
      )
      .run(row.id, row.kind, row.payloadJson, row.createdAt, row.updatedAt);
    return row;
  },

  list(): BackgroundJob[] {
    return sqlite
      .prepare(
        `SELECT id, kind, payload_json as payloadJson, status, result_json as resultJson,
                error, created_at as createdAt, updated_at as updatedAt
         FROM background_jobs ORDER BY created_at DESC LIMIT 100`,
      )
      .all() as BackgroundJob[];
  },

  nextQueued(): BackgroundJob | undefined {
    return sqlite
      .prepare(
        `SELECT id, kind, payload_json as payloadJson, status, result_json as resultJson,
                error, created_at as createdAt, updated_at as updatedAt
         FROM background_jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1`,
      )
      .get() as BackgroundJob | undefined;
  },

  markRunning(id: string) {
    sqlite
      .prepare(`UPDATE background_jobs SET status = 'running', updated_at = ? WHERE id = ?`)
      .run(Date.now(), id);
  },

  markCompleted(id: string, result: unknown) {
    sqlite
      .prepare(
        `UPDATE background_jobs SET status = 'completed', result_json = ?, updated_at = ? WHERE id = ?`,
      )
      .run(JSON.stringify(result), Date.now(), id);
  },

  markFailed(id: string, error: string) {
    sqlite
      .prepare(
        `UPDATE background_jobs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?`,
      )
      .run(error, Date.now(), id);
  },
};
