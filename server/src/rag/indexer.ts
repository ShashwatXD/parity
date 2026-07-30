import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { sqlite } from '../db/database.js';
import { getWorkspaceRoot } from '../workspace/paths.js';
import { chunkText, isIndexablePath } from './chunker.js';
import { embedTexts } from './embeddings.js';

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.data',
  'coverage',
  '.turbo',
]);

export type RagStatus = {
  root: string;
  chunkCount: number;
  fileCount: number;
  embeddingMode: string;
  updatedAt: number;
  lastError: string | null;
};

export type RagChunkRow = {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  content: string;
  embedding: number[] | null;
};

function walkFiles(absDir: string, root: string, out: string[]): void {
  let entries: string[] = [];
  try {
    entries = readdirSync(absDir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const abs = join(absDir, entry);
    let st;
    try {
      st = statSync(abs);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walkFiles(abs, root, out);
    } else if (st.isFile() && st.size < 400_000) {
      const rel = relative(root, abs).replaceAll('\\', '/');
      if (isIndexablePath(rel)) out.push(abs);
    }
  }
}

function chunkId(path: string, start: number, end: number, content: string): string {
  return createHash('sha1').update(`${path}:${start}:${end}:${content}`).digest('hex').slice(0, 24);
}

export function getRagStatus(): RagStatus {
  const root = getWorkspaceRoot();
  const row = sqlite
    .prepare(
      `SELECT root, chunk_count as chunkCount, file_count as fileCount,
              embedding_mode as embeddingMode, updated_at as updatedAt, last_error as lastError
       FROM rag_meta WHERE id = 'default'`,
    )
    .get() as
    | {
        root: string;
        chunkCount: number;
        fileCount: number;
        embeddingMode: string;
        updatedAt: number;
        lastError: string | null;
      }
    | undefined;

  if (!row) {
    return {
      root,
      chunkCount: 0,
      fileCount: 0,
      embeddingMode: 'none',
      updatedAt: 0,
      lastError: null,
    };
  }
  return {
    root: row.root || root,
    chunkCount: row.chunkCount,
    fileCount: row.fileCount,
    embeddingMode: row.embeddingMode,
    updatedAt: row.updatedAt,
    lastError: row.lastError,
  };
}

function upsertMeta(input: {
  root: string;
  chunkCount: number;
  fileCount: number;
  embeddingMode: string;
  lastError?: string | null;
}) {
  sqlite
    .prepare(
      `INSERT INTO rag_meta (id, root, chunk_count, file_count, embedding_mode, updated_at, last_error)
       VALUES ('default', ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         root = excluded.root,
         chunk_count = excluded.chunk_count,
         file_count = excluded.file_count,
         embedding_mode = excluded.embedding_mode,
         updated_at = excluded.updated_at,
         last_error = excluded.last_error`,
    )
    .run(
      input.root,
      input.chunkCount,
      input.fileCount,
      input.embeddingMode,
      Date.now(),
      input.lastError ?? null,
    );
}

export function listAllChunks(): RagChunkRow[] {
  const rows = sqlite
    .prepare(
      `SELECT id, path, start_line as startLine, end_line as endLine, content, embedding_json as embeddingJson
       FROM rag_chunks`,
    )
    .all() as Array<{
    id: string;
    path: string;
    startLine: number;
    endLine: number;
    content: string;
    embeddingJson: string | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    path: r.path,
    startLine: r.startLine,
    endLine: r.endLine,
    content: r.content,
    embedding: r.embeddingJson ? (JSON.parse(r.embeddingJson) as number[]) : null,
  }));
}

export async function indexWorkspace(_opts?: {
  withEmbeddings?: boolean;
}): Promise<RagStatus> {
  const root = getWorkspaceRoot();
  const files: string[] = [];
  walkFiles(root, root, files);

  type Pending = {
    id: string;
    path: string;
    startLine: number;
    endLine: number;
    content: string;
  };
  const pending: Pending[] = [];
  const fileSet = new Set<string>();

  for (const abs of files) {
    const rel = relative(root, abs).replaceAll('\\', '/');
    let text = '';
    try {
      text = readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    if (text.includes('\u0000')) continue;
    fileSet.add(rel);
    for (const c of chunkText(rel, text)) {
      pending.push({
        id: chunkId(c.path, c.startLine, c.endLine, c.content),
        path: c.path,
        startLine: c.startLine,
        endLine: c.endLine,
        content: c.content,
      });
    }
  }

  let embeddingMode = 'voyage-code-3';
  let vectors: number[][] = [];

  if (!pending.length) {
    upsertMeta({
      root,
      chunkCount: 0,
      fileCount: 0,
      embeddingMode: 'none',
      lastError: null,
    });
    sqlite.exec('BEGIN');
    try {
      sqlite.prepare('DELETE FROM rag_chunks').run();
      sqlite.exec('COMMIT');
    } catch (e) {
      sqlite.exec('ROLLBACK');
      throw e;
    }
    return getRagStatus();
  }

  // Embeddings are required — no lexical-only index
  const batchSize = 64;
  const all: number[][] = [];
  for (let i = 0; i < pending.length; i += batchSize) {
    const batch = pending.slice(i, i + batchSize);
    const res = await embedTexts(
      batch.map((p) => `${p.path}\n${p.content}`),
      'document',
    );
    embeddingMode = res.model || res.mode;
    if (res.vectors.length !== batch.length) {
      throw new Error('Embedding batch size mismatch');
    }
    all.push(...res.vectors);
  }
  vectors = all;

  const clear = sqlite.prepare('DELETE FROM rag_chunks');
  const insert = sqlite.prepare(
    `INSERT INTO rag_chunks (id, path, start_line, end_line, content, embedding_json, indexed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  sqlite.exec('BEGIN');
  try {
    clear.run();
    const now = Date.now();
    for (let i = 0; i < pending.length; i++) {
      const p = pending[i]!;
      const emb = vectors[i];
      if (!emb?.length) throw new Error(`Missing embedding for chunk ${p.path}:${p.startLine}`);
      insert.run(p.id, p.path, p.startLine, p.endLine, p.content, JSON.stringify(emb), now);
    }
    sqlite.exec('COMMIT');
  } catch (e) {
    sqlite.exec('ROLLBACK');
    throw e;
  }

  upsertMeta({
    root,
    chunkCount: pending.length,
    fileCount: fileSet.size,
    embeddingMode,
    lastError: null,
  });

  return getRagStatus();
}
