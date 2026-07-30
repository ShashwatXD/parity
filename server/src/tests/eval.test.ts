import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scoreRun } from '../eval/rubric.js';
import { runEvalSuite } from '../eval/suite.js';
import type { ExecutionEvent } from '../models.js';

function evt(partial: Partial<ExecutionEvent> & Pick<ExecutionEvent, 'kind' | 'label'>): ExecutionEvent {
  return {
    id: partial.id ?? `evt_${Math.random()}`,
    runId: partial.runId ?? 'run_test',
    sessionId: partial.sessionId ?? 'session_test',
    kind: partial.kind,
    label: partial.label,
    detailJson: null,
    status: partial.status ?? 'ok',
    latencyMs: partial.latencyMs ?? 10,
    tokensPrompt: 0,
    tokensCompletion: 0,
    costUsd: 0,
    createdAt: partial.createdAt ?? Date.now(),
  };
}

describe('eval rubric', () => {
  it('scores a clean completed run highly', () => {
    const report = scoreRun([
      evt({ kind: 'user_prompt', label: 'hi' }),
      evt({ kind: 'tool_call', label: 'terminal' }),
      evt({ kind: 'react_step', label: 'step 1' }),
      evt({ kind: 'assistant_response', label: 'done' }),
    ]);
    assert.ok(report);
    assert.ok(report!.overall >= 80);
    assert.ok(['A', 'B'].includes(report!.grade));
  });

  it('penalizes stuck + tool errors', () => {
    const report = scoreRun([
      evt({ kind: 'user_prompt', label: 'hi' }),
      evt({ kind: 'tool_error', label: 'terminal', status: 'error' }),
      evt({ kind: 'tool_error', label: 'terminal', status: 'error' }),
      evt({ kind: 'stuck', label: 'loop', status: 'error' }),
      evt({ kind: 'assistant_response', label: 'gave up' }),
    ]);
    assert.ok(report);
    assert.ok(report!.overall < 80);
  });
});

describe('eval suite', () => {
  it('passes offline regression cases', async () => {
    const report = await runEvalSuite();
    assert.equal(report.failed, 0, report.cases.filter((c) => !c.passed).map((c) => c.detail).join('; '));
  });
});
