import assert from 'node:assert/strict';
import test from 'node:test';
import { migrate } from '../db/database.js';
import { shouldRetrieveMemory } from '../memory/retrievalGate.js';
import { formatMemoriesForPrompt, gatedRetrieveMemories } from '../memory/retrieve.js';
import { MemoryRepository } from '../repositories/memoryRepository.js';

migrate();

test('memory repository CRUD and search', () => {
  const fact = MemoryRepository.add({
    kind: 'fact',
    subject: 'Raj',
    content: 'Raj prefers evening tennis games',
    source: 'test',
  });
  assert.ok(fact.id.startsWith('mem_'));
  assert.equal(fact.subject, 'raj');

  const episode = MemoryRepository.add({
    kind: 'episode',
    content: 'Scheduled swim with Sergey',
    happenedAt: '2026-07-26',
    source: 'test',
  });
  assert.equal(episode.kind, 'episode');

  const found = MemoryRepository.search('raj tennis');
  assert.ok(found.some((m) => m.id === fact.id));

  const updated = MemoryRepository.update(fact.id, {
    content: 'Raj prefers morning meetings',
  });
  assert.equal(updated?.content, 'Raj prefers morning meetings');

  assert.equal(MemoryRepository.delete(fact.id), true);
  assert.equal(MemoryRepository.get(fact.id), undefined);
  assert.equal(MemoryRepository.delete(episode.id), true);
});

test('retrieval gate skips math and greets, retrieves personal context', () => {
  const skipMath = shouldRetrieveMemory("what's 2+2?");
  assert.equal(skipMath.retrieve, false);

  const skipHi = shouldRetrieveMemory('hello');
  assert.equal(skipHi.retrieve, false);

  const retrieve = shouldRetrieveMemory('When am I meeting Raj?');
  assert.equal(retrieve.retrieve, true);
  assert.match(retrieve.reason, /retrieve/i);

  const remember = shouldRetrieveMemory('Remember that I prefer dark mode');
  assert.equal(remember.retrieve, true);
});

test('gated retrieve injects matching memories into prompt block', () => {
  const row = MemoryRepository.add({
    kind: 'fact',
    subject: 'editor',
    content: 'User prefers VS Code keybindings',
    source: 'test',
  });

  const hit = gatedRetrieveMemories('What editor preferences do I have?');
  assert.equal(hit.gate.retrieve, true);
  assert.ok(hit.memories.some((m) => m.id === row.id));
  assert.match(hit.promptBlock, /User memory/);
  assert.match(hit.promptBlock, /VS Code/);

  const skip = gatedRetrieveMemories('hi');
  assert.equal(skip.gate.retrieve, false);
  assert.equal(skip.promptBlock, '');

  MemoryRepository.delete(row.id);
});

test('formatMemoriesForPrompt handles empty and episode rows', () => {
  assert.equal(formatMemoriesForPrompt([]), '');
  const block = formatMemoriesForPrompt([
    {
      id: 'mem_x',
      kind: 'episode',
      subject: '',
      content: 'Shipped memory panel',
      happenedAt: '2026-07-31',
      source: 'test',
      createdAt: 1,
      updatedAt: 1,
    },
  ]);
  assert.match(block, /episode/);
  assert.match(block, /2026-07-31/);
});
