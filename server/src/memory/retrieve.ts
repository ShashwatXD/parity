import { MemoryRepository } from '../repositories/memoryRepository.js';
import type { RetrievalGateDecision, UserMemory } from '../models.js';
import { shouldRetrieveMemory } from './retrievalGate.js';

export type GatedMemoryResult = {
  gate: RetrievalGateDecision;
  memories: UserMemory[];
  promptBlock: string;
};

export function formatMemoriesForPrompt(memories: UserMemory[]): string {
  if (!memories.length) return '';
  const lines = memories.map((m) => {
    if (m.kind === 'episode') {
      const when = m.happenedAt ? ` (${m.happenedAt})` : '';
      return `- [episode${when}] ${m.content}`;
    }
    const subject = m.subject ? `[${m.subject}] ` : '';
    return `- ${subject}${m.content}`;
  });
  return ['## User memory (retrieved)', ...lines].join('\n');
}

/** Gate + keyword search. Safe to call every turn. */
export function gatedRetrieveMemories(message: string, topK = 6): GatedMemoryResult {
  const gate = shouldRetrieveMemory(message);
  if (!gate.retrieve) {
    return { gate, memories: [], promptBlock: '' };
  }
  const memories = MemoryRepository.search(gate.query || message, topK);
  return {
    gate,
    memories,
    promptBlock: formatMemoriesForPrompt(memories),
  };
}
