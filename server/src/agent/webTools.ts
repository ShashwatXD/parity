import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { searchWeb } from './searchWeb.js';

export function buildWebTools(): ToolSet {
  return {
    search_web: tool({
      description:
        'Search the public web for current facts (FX rates, news, docs, schedules). Use this whenever the user asks for live/up-to-date information you do not already know — do not claim you lack internet access.',
      inputSchema: z.object({
        query: z.string().describe('Search query, e.g. "USD to INR exchange rate today"'),
        max_results: z.number().int().min(1).max(10).optional(),
      }),
      execute: async (args) => searchWeb(args.query, args.max_results ?? 5),
    }),
  };
}
