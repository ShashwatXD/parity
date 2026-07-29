import { ExecutionRepository } from '../repositories/executionRepository.js';
import type { ExecutionEvent } from '../models.js';

export type { ExecutionEvent };

export function startRun(sessionId?: string) {
  return ExecutionRepository.startRun(sessionId);
}

export function recordEvent(input: {
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
  return ExecutionRepository.recordEvent(input);
}

export function listEvents(runId?: string, sessionId?: string) {
  return ExecutionRepository.listEvents(runId, sessionId);
}

export function metricsSummary() {
  return ExecutionRepository.metricsSummary();
}
