import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chunkText, tokenize } from '../rag/chunker.js';
import { cosineSimilarity } from '../rag/rank.js';
import { migrate } from '../db/database.js';
import { indexWorkspace } from '../rag/indexer.js';
import { searchCodebase } from '../rag/retrieve.js';

migrate();

describe('rag chunker', () => {
  it('chunks long files with overlap', () => {
    const text = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n');
    const chunks = chunkText('demo.ts', text, { maxLines: 40, overlap: 8 });
    assert.ok(chunks.length >= 2);
    assert.equal(chunks[0]?.startLine, 1);
    assert.ok((chunks[0]?.endLine ?? 0) <= 40);
  });

  it('tokenizes identifiers', () => {
    assert.deepEqual(tokenize('Hello_World 123!'), ['hello_world', '123']);
  });
});

describe('rag vectors', () => {
  it('ranks closer vectors higher via cosine', () => {
    const q = [1, 0, 0];
    assert.ok(cosineSimilarity(q, [0.9, 0.1, 0]) > cosineSimilarity(q, [0, 1, 0]));
  });
});

describe('rag index+search', () => {
  it('indexes workspace and finds README-ish content', async () => {
    process.env.PARITY_FAKE_EMBEDDINGS = '1';
    const status = await indexWorkspace();
    assert.ok(status.chunkCount >= 1);
    assert.notEqual(status.embeddingMode, 'none');
    const result = await searchCodebase('parity workspace sandbox agent', 5);
    assert.ok(result.hits.length >= 1);
    assert.match(result.mode, /embedding|fake/);
  });
});
