import { sqlite } from '../db/database.js';
import { createId } from '../lib/ids.js';
import type { ExecutionEvent, MetricsSummary } from '../models.js';

export const ExecutionRepository = {
  startRun(sessionId?: string) {
    return {
      runId: createId('run'),
      sessionId: sessionId ?? null,
      startedAt: Date.now(),
    };
  },

  recordEvent(input: {
    runId: string;
    sessionId?: string | null;
    kind: string;
    label: string;
    detail?: unknown;
    status?: string;
    latencyMs?: number;
    tokensPrompt?: number;
    tokensCompletion?: number;
    costUsd?: number;
  }): ExecutionEvent {
    const row: ExecutionEvent = {
      id: createId('event'),
      runId: input.runId,
      sessionId: input.sessionId ?? null,
      kind: input.kind,
      label: input.label,
      detailJson: input.detail == null ? null : JSON.stringify(input.detail),
      status: input.status ?? 'ok',
      latencyMs: input.latencyMs ?? 0,
      tokensPrompt: input.tokensPrompt ?? 0,
      tokensCompletion: input.tokensCompletion ?? 0,
      costUsd: input.costUsd ?? 0,
      createdAt: Date.now(),
    };
    sqlite
      .prepare(
        `INSERT INTO execution_events (
           id, run_id, session_id, kind, label, detail_json, status,
           latency_ms, tokens_prompt, tokens_completion, cost_usd, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.runId,
        row.sessionId,
        row.kind,
        row.label,
        row.detailJson,
        row.status,
        row.latencyMs,
        row.tokensPrompt,
        row.tokensCompletion,
        row.costUsd,
        row.createdAt,
      );
    return row;
  },

  listEvents(runId?: string, sessionId?: string): ExecutionEvent[] {
    const select = `SELECT id, run_id as runId, session_id as sessionId, kind, label,
            detail_json as detailJson, status, latency_ms as latencyMs,
            tokens_prompt as tokensPrompt, tokens_completion as tokensCompletion,
            cost_usd as costUsd, created_at as createdAt
     FROM execution_events`;
    if (runId) {
      return sqlite
        .prepare(`${select} WHERE run_id = ? ORDER BY created_at ASC`)
        .all(runId) as ExecutionEvent[];
    }
    if (sessionId) {
      return sqlite
        .prepare(`${select} WHERE session_id = ? ORDER BY created_at ASC`)
        .all(sessionId) as ExecutionEvent[];
    }
    return sqlite
      .prepare(`${select} ORDER BY created_at DESC LIMIT 200`)
      .all() as ExecutionEvent[];
  },

  metricsSummary(): MetricsSummary {
    return sqlite
      .prepare(
        `SELECT
           COUNT(*) as events,
           COALESCE(SUM(latency_ms), 0) as totalLatencyMs,
           COALESCE(SUM(tokens_prompt), 0) as promptTokens,
           COALESCE(SUM(tokens_completion), 0) as completionTokens,
           COALESCE(SUM(cost_usd), 0) as costUsd
         FROM execution_events`,
      )
      .get() as MetricsSummary;
  },
};
