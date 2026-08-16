import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { searchConversationHistory } from '../memory/historyIntelligence.js';

function ok(data: unknown) {
  return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return `ERROR: ${message}`;
}

/** Cross-session conversation history search (separate from durable user memory). */
export function buildHistoryTools(currentSessionId: string): ToolSet {
  return {
    search_history: tool({
      description:
        'Search prior chat sessions for relevant turns. Use when the user refers to earlier conversations, decisions, or "last time" — not for durable preferences (use recall_memory) or codebase (use codebase_search).',
      inputSchema: z.object({
        query: z.string().describe('Keywords or natural language about past chats'),
        limit: z.number().int().min(1).max(12).optional(),
      }),
      execute: async (args) => {
        try {
          const hits = searchConversationHistory(args.query, {
            limit: args.limit ?? 6,
            excludeSessionId: currentSessionId,
          });
          return ok({
            query: args.query,
            hits: hits.map((h) => ({
              sessionId: h.sessionId,
              sessionTitle: h.sessionTitle,
              role: h.role,
              score: h.score,
              excerpt: h.excerpt,
              createdAt: h.createdAt,
            })),
          });
        } catch (e) {
          return fail(e);
        }
      },
    }),
  };
}
