import { cosineSimilarity } from './rank.js';
import { embedTexts } from './embeddings.js';
import { getRagStatus, listAllChunks, type RagStatus } from './indexer.js';

export type RagHit = {
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  content: string;
};

export type RagSearchResult = {
  query: string;
  mode: string;
  hits: RagHit[];
  status: RagStatus;
};

/** Pure vector retrieval — requires an embedding index (no lexical-only fallback). */
export async function searchCodebase(
  query: string,
  limit = 8,
): Promise<RagSearchResult> {
  const status = getRagStatus();
  const chunks = listAllChunks();
  if (!chunks.length) {
    return { query, mode: 'empty', hits: [], status };
  }

  const withVectors = chunks.filter((c) => c.embedding && c.embedding.length);
  if (!withVectors.length) {
    throw new Error(
      'RAG index has no embeddings. Reindex with EMBEDDING_API_KEY / OPENAI_API_KEY configured (text-embedding-3-large by default).',
    );
  }

  const { vectors, model } = await embedTexts([query], 'query');
  const qVec = vectors[0];
  if (!qVec?.length) throw new Error('Failed to embed query');

  const hits = withVectors
    .map((c) => ({
      path: c.path,
      startLine: c.startLine,
      endLine: c.endLine,
      score: cosineSimilarity(qVec, c.embedding!),
      content: c.content,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    query,
    mode: `embedding:${model || status.embeddingMode}`,
    hits,
    status,
  };
}

export function formatHitsForAgent(result: RagSearchResult): string {
  if (!result.hits.length) {
    return JSON.stringify({
      message:
        result.mode === 'empty'
          ? 'Index is empty. Reindex in the Files panel (requires embedding API key).'
          : 'No matching chunks.',
      status: result.status,
    });
  }
  return JSON.stringify(
    {
      mode: result.mode,
      hits: result.hits.map((h) => ({
        path: h.path,
        lines: `${h.startLine}-${h.endLine}`,
        score: Number(h.score.toFixed(4)),
        excerpt: h.content.slice(0, 1200),
      })),
    },
    null,
    2,
  );
}
