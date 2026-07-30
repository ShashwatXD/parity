import { createHash } from 'node:crypto';
import { getSettings } from '../runtime/settings.js';

export type EmbeddingConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type EmbedInputType = 'document' | 'query';

/**
 * LLM-agnostic code embeddings (same idea as coding-agent RAG stacks).
 *
 * OpenHands Agent Canvas does not ship first-party codebase RAG; code-search
 * experiments / ecosystem commonly use a dedicated embedder separate from the
 * chat model. We default to Voyage `voyage-code-3` — specialized for code and
 * independent of whether you chat with OpenAI, Anthropic, Gemini, or Ollama.
 *
 * Override with EMBEDDING_* or Settings → Workspace (any OpenAI-compatible
 * /v1/embeddings host still works, e.g. text-embedding-3-large).
 */
export function resolveEmbeddingConfig(): EmbeddingConfig {
  const settings = getSettings();
  const emb = settings.embedding;

  const apiKey =
    process.env.EMBEDDING_API_KEY?.trim() ||
    process.env.VOYAGE_API_KEY?.trim() ||
    emb?.apiKey?.trim() ||
    '';

  const baseUrl = (
    process.env.EMBEDDING_BASE_URL?.trim() ||
    emb?.baseUrl?.trim() ||
    'https://api.voyageai.com/v1'
  ).replace(/\/$/, '');

  const model =
    process.env.EMBEDDING_MODEL?.trim() || emb?.model?.trim() || 'voyage-code-3';

  if (!apiKey) {
    throw new Error(
      'Embedding API key required for RAG. Set VOYAGE_API_KEY or EMBEDDING_API_KEY (Settings → Workspace). This is separate from your chat LLM.',
    );
  }

  return { apiKey, baseUrl, model };
}

function fakeVector(text: string, dims = 64): number[] {
  const out = new Array<number>(dims).fill(0);
  const tokens = text.toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean);
  for (const t of tokens) {
    const h = createHash('sha256').update(t).digest();
    for (let i = 0; i < dims; i++) out[i] = (out[i] ?? 0) + h[i % h.length]! / 255;
  }
  const norm = Math.sqrt(out.reduce((s, x) => s + x * x, 0)) || 1;
  return out.map((x) => x / norm);
}

function isVoyage(cfg: EmbeddingConfig): boolean {
  return (
    cfg.model.startsWith('voyage') ||
    cfg.baseUrl.includes('voyageai.com')
  );
}

/**
 * Embed texts with the configured model. No lexical fallback.
 * For Voyage, pass inputType document (index) vs query (search).
 */
export async function embedTexts(
  texts: string[],
  inputType: EmbedInputType = 'document',
): Promise<{
  mode: string;
  model: string;
  vectors: number[][];
}> {
  if (!texts.length) return { mode: 'embedding', model: '', vectors: [] };

  if (process.env.PARITY_FAKE_EMBEDDINGS === '1') {
    return {
      mode: 'fake-test',
      model: 'fake',
      vectors: texts.map((t) => fakeVector(t)),
    };
  }

  const cfg = resolveEmbeddingConfig();
  const url = `${cfg.baseUrl}/embeddings`;
  const batchSize = isVoyage(cfg) ? 128 : 64;
  const vectors: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize).map((t) => t.slice(0, 24_000));
    const body: Record<string, unknown> = {
      model: cfg.model,
      input: batch,
    };
    // Voyage (and some code embedders) take asymmetric query/document types
    if (isVoyage(cfg)) {
      body.input_type = inputType;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(
        `Embedding API failed (${res.status}) model=${cfg.model}: ${errBody.slice(0, 400)}`,
      );
    }

    const json = (await res.json()) as {
      data?: Array<{ embedding?: number[]; index?: number }>;
      embeddings?: number[][]; // some providers
    };

    let batchVectors: number[][] = [];
    if (Array.isArray(json.data) && json.data.length) {
      const ordered = [...json.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      batchVectors = ordered.map((row) => {
        if (!Array.isArray(row.embedding) || !row.embedding.length) {
          throw new Error('Embedding API returned an empty vector');
        }
        return row.embedding;
      });
    } else if (Array.isArray(json.embeddings) && json.embeddings.length) {
      batchVectors = json.embeddings;
    }

    if (batchVectors.length !== batch.length) {
      throw new Error(
        `Embedding API returned ${batchVectors.length} vectors for ${batch.length} inputs`,
      );
    }
    vectors.push(...batchVectors);
  }

  return { mode: isVoyage(cfg) ? 'voyage' : 'openai-compatible', model: cfg.model, vectors };
}
