import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { MemoryRepository } from '../repositories/memoryRepository.js';

function ok(data: unknown) {
  return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return `ERROR: ${message}`;
}

/** Agent tools for durable user memory (facts + episodes). */
export function buildMemoryTools(): ToolSet {
  return {
    remember: tool({
      description:
        'Save a durable fact or dated episode about the user into long-term memory. Use when they say "remember", share a preference, or teach a lasting detail.',
      inputSchema: z.object({
        kind: z.enum(['fact', 'episode']).default('fact'),
        subject: z
          .string()
          .optional()
          .describe('Short topic label, e.g. "raj", "editor", "meetings"'),
        content: z.string().describe('The durable fact or episode summary'),
        happened_at: z
          .string()
          .optional()
          .describe('ISO date or human date for episodes, e.g. 2026-07-31'),
      }),
      execute: async (args) => {
        try {
          const row = MemoryRepository.add({
            kind: args.kind,
            subject: args.subject,
            content: args.content,
            happenedAt: args.happened_at ?? null,
            source: 'agent',
          });
          return ok({ saved: true, id: row.id, kind: row.kind, subject: row.subject });
        } catch (e) {
          return fail(e);
        }
      },
    }),

    recall_memory: tool({
      description:
        'Search long-term user memory (facts and episodes) by keywords. Prefer this when asking about past preferences or events. For prior chat transcripts use search_history instead.',
      inputSchema: z.object({
        query: z.string().describe('Keywords to search'),
        limit: z.number().int().min(1).max(20).optional(),
      }),
      execute: async (args) => {
        try {
          const rows = MemoryRepository.search(args.query, args.limit ?? 8);
          return ok(
            rows.map((r) => ({
              id: r.id,
              kind: r.kind,
              subject: r.subject,
              content: r.content,
              happenedAt: r.happenedAt,
            })),
          );
        } catch (e) {
          return fail(e);
        }
      },
    }),

    forget_memory: tool({
      description:
        'Delete a memory by id after the user says a fact is wrong or should be forgotten. Search first with recall_memory to get the id.',
      inputSchema: z.object({
        id: z.string().describe('Memory id from recall_memory'),
      }),
      execute: async (args) => {
        try {
          const deleted = MemoryRepository.delete(args.id);
          return ok({ deleted, id: args.id });
        } catch (e) {
          return fail(e);
        }
      },
    }),
  };
}
