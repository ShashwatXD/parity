import { readFileSync } from 'node:fs';
import { getRagStatus, listAllChunks } from '../rag/indexer.js';
import { searchCodebase } from '../rag/retrieve.js';
import { scoreGroundedness, type GroundingContext } from './groundedness.js';

export type GoldenQuestion = {
  id: string;
  question: string;
  /** Any one of these paths counts as a correct retrieval. */
  expectPaths: string[];
};

export type GoldenCaseResult = {
  id: string;
  question: string;
  expectPaths: string[];
  topPaths: string[];
  /** 1-based position of the first expected path, or null when it never ranked. */
  rank: number | null;
  hit: boolean;
  status: 'ok' | 'skipped';
  detail: string;
};

export type GoldenReport = {
  ranAt: number;
  status: 'ok' | 'skipped';
  reason: string | null;
  mode: string;
  k: number;
  cases: GoldenCaseResult[];
  recallAtK: number | null;
  mrr: number | null;
  summary: string;
};

/**
 * Golden set for Parity's own repository. Retrieval quality regressions are
 * invisible to unit tests — a chunker or reranker change can keep every test
 * green while quietly burying the right file below the cutoff.
 *
 * Point PARITY_GOLDEN_FILE at a JSON array of GoldenQuestion to evaluate a
 * different workspace.
 */
export const GOLDEN_QUESTIONS: GoldenQuestion[] = [
  {
    id: 'embeddings-provider',
    question: 'where are code embeddings requested from the provider',
    expectPaths: ['server/src/rag/embeddings.ts'],
  },
  {
    id: 'vector-storage',
    question: 'where are chunk embeddings written to the database',
    expectPaths: ['server/src/rag/indexer.ts', 'server/src/db/database.ts'],
  },
  {
    id: 'stuck-detection',
    question: 'how does the agent detect repeated identical tool calls',
    expectPaths: ['server/src/agent/stuckDetector.ts'],
  },
  {
    id: 'context-window',
    question: 'how is the context window trimmed or condensed',
    expectPaths: ['server/src/runtime/contextWindow.ts'],
  },
  {
    id: 'mcp-transport',
    question: 'how are mcp servers connected over stdio and http',
    expectPaths: ['server/src/mcp/manager.ts'],
  },
  {
    id: 'workspace-sandbox',
    question: 'how are paths prevented from escaping the workspace sandbox',
    expectPaths: ['server/src/workspace/paths.ts'],
  },
  {
    id: 'approvals',
    question: 'where are human approval requests for tool calls stored',
    expectPaths: ['server/src/repositories/approvalRepository.ts'],
  },
  {
    id: 'cost-tracking',
    question: 'how are token usage and cost computed for a run',
    expectPaths: ['server/src/observability/cost.ts'],
  },
];

function loadQuestions(): GoldenQuestion[] {
  const custom = process.env.PARITY_GOLDEN_FILE?.trim();
  if (!custom) return GOLDEN_QUESTIONS;
  const parsed = JSON.parse(readFileSync(custom, 'utf8')) as GoldenQuestion[];
  if (!Array.isArray(parsed) || !parsed.length) {
    throw new Error(`PARITY_GOLDEN_FILE has no questions: ${custom}`);
  }
  return parsed;
}

function samePath(a: string, b: string): boolean {
  if (a === b) return true;
  return a.endsWith(`/${b}`) || b.endsWith(`/${a}`);
}

/** 1-based rank of the first expected path in the ranked results. */
export function rankOfExpected(rankedPaths: string[], expectPaths: string[]): number | null {
  for (let i = 0; i < rankedPaths.length; i++) {
    const path = rankedPaths[i]!;
    if (expectPaths.some((expected) => samePath(path, expected))) return i + 1;
  }
  return null;
}

export function computeRecall(cases: GoldenCaseResult[]): number | null {
  const scored = cases.filter((c) => c.status === 'ok');
  if (!scored.length) return null;
  return Number((scored.filter((c) => c.hit).length / scored.length).toFixed(3));
}

export function computeMrr(cases: GoldenCaseResult[]): number | null {
  const scored = cases.filter((c) => c.status === 'ok');
  if (!scored.length) return null;
  const total = scored.reduce((sum, c) => sum + (c.rank ? 1 / c.rank : 0), 0);
  return Number((total / scored.length).toFixed(3));
}

/**
 * Runs each golden question through real retrieval and reports recall@k and MRR.
 * Requires an embedding index; returns a skipped report instead of throwing so
 * it can sit in a dashboard that loads before any workspace is indexed.
 */
export async function runGoldenSuite(opts?: { k?: number }): Promise<GoldenReport> {
  const k = opts?.k ?? 5;
  const ranAt = Date.now();
  const status = getRagStatus();

  const skipped = (reason: string): GoldenReport => ({
    ranAt,
    status: 'skipped',
    reason,
    mode: status.embeddingMode,
    k,
    cases: [],
    recallAtK: null,
    mrr: null,
    summary: `Golden retrieval suite skipped — ${reason}`,
  });

  if (!status.chunkCount) return skipped('workspace is not indexed');

  let questions: GoldenQuestion[];
  try {
    questions = loadQuestions();
  } catch (error) {
    return skipped(error instanceof Error ? error.message : String(error));
  }

  // Questions about files absent from this workspace are unanswerable rather
  // than wrong, so they are skipped instead of counted as misses.
  const indexedPaths = [...new Set(listAllChunks().map((c) => c.path))];
  const isIndexed = (expected: string[]) =>
    expected.some((e) => indexedPaths.some((p) => samePath(p, e)));

  const cases: GoldenCaseResult[] = [];
  let mode = status.embeddingMode;

  for (const question of questions) {
    if (!isIndexed(question.expectPaths)) {
      cases.push({
        id: question.id,
        question: question.question,
        expectPaths: question.expectPaths,
        topPaths: [],
        rank: null,
        hit: false,
        status: 'skipped',
        detail: 'expected paths are not in this index',
      });
      continue;
    }

    try {
      const result = await searchCodebase(question.question, k);
      mode = result.mode || mode;
      const topPaths = result.hits.map((h) => h.path);
      const rank = rankOfExpected(topPaths, question.expectPaths);
      cases.push({
        id: question.id,
        question: question.question,
        expectPaths: question.expectPaths,
        topPaths,
        rank,
        hit: rank !== null,
        status: 'ok',
        detail: rank ? `expected file at rank ${rank}` : `missed — top: ${topPaths[0] ?? 'none'}`,
      });
    } catch (error) {
      return skipped(error instanceof Error ? error.message : String(error));
    }
  }

  const recallAtK = computeRecall(cases);
  const mrr = computeMrr(cases);
  const evaluated = cases.filter((c) => c.status === 'ok').length;
  const hits = cases.filter((c) => c.hit).length;

  return {
    ranAt,
    status: 'ok',
    reason: null,
    mode,
    k,
    cases,
    recallAtK,
    mrr,
    summary: `Golden retrieval ${hits}/${evaluated} hit@${k} (recall ${
      recallAtK === null ? 'n/a' : Math.round(recallAtK * 100) + '%'
    }, MRR ${mrr ?? 'n/a'}).`,
  };
}

/**
 * Retrieves context for a question and grades an answer against only what was
 * retrieved — the check that catches a confident answer with no support behind it.
 */
export async function evaluateAnswerGroundedness(input: {
  question: string;
  answer: string;
  k?: number;
}) {
  const result = await searchCodebase(input.question, input.k ?? 5);
  const contexts: GroundingContext[] = result.hits.map((h) => ({
    path: h.path,
    startLine: h.startLine,
    endLine: h.endLine,
    content: h.content,
  }));
  return {
    question: input.question,
    retrieved: contexts.map((c) => `${c.path}:${c.startLine}-${c.endLine}`),
    report: scoreGroundedness({ answer: input.answer, contexts }),
  };
}
