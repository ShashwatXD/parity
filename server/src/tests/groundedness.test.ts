import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractCitations,
  scoreGroundedness,
  splitClaims,
  validateCitation,
  type GroundingContext,
} from '../eval/groundedness.js';
import { computeMrr, computeRecall, rankOfExpected, type GoldenCaseResult } from '../eval/golden.js';

const contexts: GroundingContext[] = [
  {
    path: 'server/src/rag/indexer.ts',
    startLine: 200,
    endLine: 240,
    content:
      'const insert = sqlite.prepare("INSERT INTO rag_chunks (id, path, start_line, end_line, content, embedding_json, indexed_at) VALUES (?, ?, ?, ?, ?, ?, ?)");',
  },
  {
    path: 'server/src/rag/retrieve.ts',
    startLine: 20,
    endLine: 55,
    content:
      'const hits = withVectors.map((c) => ({ path: c.path, score: cosineSimilarity(qVec, c.embedding) })).sort((a, b) => b.score - a.score);',
  },
];

describe('groundedness claims', () => {
  it('splits prose and bullets into claims and drops filler', () => {
    const claims = splitClaims('Chunks are inserted into rag_chunks.\n- Ranking uses cosine similarity.\nOk.');
    assert.equal(claims.length, 2);
    assert.ok(claims[1]?.startsWith('Ranking uses cosine'));
  });

  it('marks a claim supported by the retrieved context', () => {
    const report = scoreGroundedness({
      answer: 'Chunks are inserted into rag_chunks with an embedding_json column.',
      contexts,
    });
    assert.equal(report.unsupported.length, 0);
    assert.ok(report.score >= 60, report.summary);
  });

  it('flags a confident claim with no support in context', () => {
    const report = scoreGroundedness({
      answer: 'Vectors are sharded across a Redis cluster using HNSW graphs for approximate search.',
      contexts,
    });
    assert.ok(report.unsupported.length >= 1);
    assert.ok(report.score < 60, report.summary);
  });

  it('scores an answer with no claims as zero rather than throwing', () => {
    const report = scoreGroundedness({ answer: 'Ok.', contexts });
    assert.equal(report.claims.length, 0);
    assert.equal(report.score, 0);
  });
});

describe('groundedness citations', () => {
  it('extracts bare paths and line ranges', () => {
    const found = extractCitations('See server/src/rag/retrieve.ts:20-55 and server/src/rag/indexer.ts.');
    assert.equal(found.length, 2);
    assert.equal(found[0]?.startLine, 20);
    assert.equal(found[0]?.endLine, 55);
    assert.equal(found[1]?.startLine, null);
  });

  it('accepts a cited range inside a retrieved chunk', () => {
    assert.equal(
      validateCitation(
        { raw: 'x', path: 'server/src/rag/retrieve.ts', startLine: 30, endLine: 40 },
        contexts,
      ),
      true,
    );
  });

  it('rejects a file that was never retrieved', () => {
    assert.equal(
      validateCitation({ raw: 'x', path: 'server/src/rag/pinecone.ts', startLine: null, endLine: null }, contexts),
      false,
    );
  });

  it('rejects lines outside the retrieved chunk', () => {
    assert.equal(
      validateCitation(
        { raw: 'x', path: 'server/src/rag/retrieve.ts', startLine: 900, endLine: 950 },
        contexts,
      ),
      false,
    );
  });

  it('penalizes a fabricated citation in the combined score', () => {
    const honest = scoreGroundedness({
      answer: 'Ranking uses cosine similarity over stored vectors, see server/src/rag/retrieve.ts:20-55.',
      contexts,
    });
    const fabricated = scoreGroundedness({
      answer: 'Ranking uses cosine similarity over stored vectors, see server/src/rag/pinecone.ts:20-55.',
      contexts,
    });
    assert.ok(honest.score > fabricated.score, `${honest.score} should beat ${fabricated.score}`);
  });
});

describe('golden retrieval metrics', () => {
  const caseAt = (rank: number | null, status: GoldenCaseResult['status'] = 'ok'): GoldenCaseResult => ({
    id: 'c',
    question: 'q',
    expectPaths: ['a.ts'],
    topPaths: [],
    rank,
    hit: rank !== null,
    status,
    detail: '',
  });

  it('ranks the first expected path, tolerating path prefixes', () => {
    const ranked = ['server/src/main.ts', 'server/src/rag/indexer.ts'];
    assert.equal(rankOfExpected(ranked, ['rag/indexer.ts']), 2);
    assert.equal(rankOfExpected(ranked, ['nope.ts']), null);
  });

  it('computes recall over evaluated cases only', () => {
    assert.equal(computeRecall([caseAt(1), caseAt(null), caseAt(2, 'skipped')]), 0.5);
  });

  it('computes MRR from reciprocal ranks', () => {
    assert.equal(computeMrr([caseAt(1), caseAt(2)]), 0.75);
  });

  it('returns null metrics when every case was skipped', () => {
    assert.equal(computeRecall([caseAt(null, 'skipped')]), null);
    assert.equal(computeMrr([caseAt(null, 'skipped')]), null);
  });
});
