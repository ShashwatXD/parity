import assert from 'node:assert/strict';
import { detectStuck, stepFromToolCall } from '../agent/stuckDetector.js';
import { listSkills } from '../agent/skills.js';
import { estimateTokens } from '../runtime/contextWindow.js';
import { resolveWorkspacePath } from '../workspace/paths.js';
import { scoreGroundedness, type GroundingContext } from './groundedness.js';

export type EvalCaseResult = {
  id: string;
  name: string;
  category: 'agent' | 'sandbox' | 'context' | 'skills' | 'grounding';
  passed: boolean;
  detail: string;
  durationMs: number;
};

export type EvalSuiteReport = {
  ranAt: number;
  passed: number;
  failed: number;
  total: number;
  passRate: number;
  cases: EvalCaseResult[];
  summary: string;
};

type CaseFn = () => void | Promise<void>;

async function runCase(
  id: string,
  name: string,
  category: EvalCaseResult['category'],
  fn: CaseFn,
): Promise<EvalCaseResult> {
  const started = Date.now();
  try {
    await fn();
    return {
      id,
      name,
      category,
      passed: true,
      detail: 'ok',
      durationMs: Date.now() - started,
    };
  } catch (error) {
    return {
      id,
      name,
      category,
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - started,
    };
  }
}

/** Offline regression suite — no LLM required. Safe to run in CI / Settings. */
export async function runEvalSuite(): Promise<EvalSuiteReport> {
  const cases: EvalCaseResult[] = [];

  cases.push(
    await runCase('stuck-repeat', 'Stuck detector catches identical tool loops', 'agent', () => {
      const steps = Array.from({ length: 4 }, () =>
        stepFromToolCall({ toolName: 'terminal', args: { command: 'ls' }, result: 'ok' }),
      );
      const v = detectStuck(steps);
      assert.equal(v.stuck, true);
    }),
  );

  cases.push(
    await runCase('stuck-progress', 'Stuck detector allows progressing calls', 'agent', () => {
      const steps = [
        stepFromToolCall({ toolName: 'glob', args: { pattern: '*.ts' }, result: 'a' }),
        stepFromToolCall({ toolName: 'grep', args: { pattern: 'foo' }, result: 'b' }),
        stepFromToolCall({ toolName: 'terminal', args: { command: 'pwd' }, result: 'c' }),
      ];
      assert.equal(detectStuck(steps).stuck, false);
    }),
  );

  cases.push(
    await runCase('sandbox-escape', 'Workspace path rejects escape attempts', 'sandbox', () => {
      assert.throws(() => resolveWorkspacePath('../etc/passwd'));
      assert.throws(() => resolveWorkspacePath('/etc/passwd'));
    }),
  );

  cases.push(
    await runCase('sandbox-relative', 'Workspace path accepts relative files', 'sandbox', () => {
      const abs = resolveWorkspacePath('README.md');
      assert.ok(abs.includes('workspace') || abs.endsWith('README.md'));
    }),
  );

  cases.push(
    await runCase('context-tokens', 'Token estimator scales with content', 'context', () => {
      const short = estimateTokens('hi');
      const long = estimateTokens('x'.repeat(4000));
      assert.ok(long > short);
      assert.ok(short >= 1);
    }),
  );

  cases.push(
    await runCase('skills-trigger', 'Coding skill triggers on implement/fix keywords', 'skills', () => {
      const hay = 'please fix this bug in the code';
      const matched = listSkills().filter(
        (s) => !s.triggers.length || s.triggers.some((t) => hay.includes(t)),
      );
      const names = matched.map((s) => s.name);
      assert.ok(
        names.includes('coding-loop') || names.includes('debugging'),
        `expected coding/debug skill, got ${names.join(',') || '(none)'}`,
      );
    }),
  );

  const groundingContexts: GroundingContext[] = [
    {
      path: 'server/src/rag/embeddings.ts',
      startLine: 70,
      endLine: 92,
      content:
        'export async function embedTexts(texts: string[], inputType: EmbedInputType = "document") { const cfg = resolveEmbeddingConfig(); const batchSize = isVoyage(cfg) ? 128 : 64; }',
    },
  ];

  cases.push(
    await runCase('grounding-supported', 'Supported answer scores as grounded', 'grounding', () => {
      const report = scoreGroundedness({
        answer: 'embedTexts batches inputs and resolves the embedding config before requesting vectors.',
        contexts: groundingContexts,
      });
      assert.ok(report.score >= 60, `expected grounded, got ${report.score} (${report.summary})`);
      assert.equal(report.unsupported.length, 0);
    }),
  );

  cases.push(
    await runCase('grounding-hallucination', 'Unsupported claim is flagged', 'grounding', () => {
      const report = scoreGroundedness({
        answer: 'Embeddings are stored in a managed Pinecone cluster replicated across three regions.',
        contexts: groundingContexts,
      });
      assert.ok(report.unsupported.length >= 1, 'expected the invented claim to be unsupported');
      assert.ok(report.score < 60, `expected low groundedness, got ${report.score}`);
    }),
  );

  cases.push(
    await runCase('grounding-citation-invalid', 'Fabricated citation is rejected', 'grounding', () => {
      const report = scoreGroundedness({
        answer: 'The batch size is resolved in server/src/rag/pinecone.ts:12 during embedTexts.',
        contexts: groundingContexts,
      });
      assert.equal(report.citations.invalid.length, 1);
    }),
  );

  cases.push(
    await runCase('grounding-citation-range', 'Out-of-range cited lines are rejected', 'grounding', () => {
      const report = scoreGroundedness({
        answer: 'See server/src/rag/embeddings.ts:900-940 for the batching logic in embedTexts.',
        contexts: groundingContexts,
      });
      assert.equal(report.citations.valid, 0);
    }),
  );

  const passed = cases.filter((c) => c.passed).length;
  const failed = cases.length - passed;
  const passRate = cases.length ? Math.round((passed / cases.length) * 100) : 0;

  return {
    ranAt: Date.now(),
    passed,
    failed,
    total: cases.length,
    passRate,
    cases,
    summary: `Eval suite ${passed}/${cases.length} passed (${passRate}%)`,
  };
}
