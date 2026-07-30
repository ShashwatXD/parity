import { generateText } from 'ai';
import { getModelForProfile, type ProviderId } from '../llm/providers.js';
import type { Message } from '../models.js';
import { MessageRepository } from '../repositories/sessionRepository.js';
import { getCondensationPrompt } from './settings.js';
import { addMessage, listMessages } from './sessions.js';

export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'gpt-4o': 128_000,
  'gpt-4o-mini': 128_000,
  'gpt-4.1': 1_000_000,
  'gpt-4.1-mini': 1_000_000,
  'claude-3-5-haiku-latest': 200_000,
  'claude-3-5-sonnet-latest': 200_000,
  'claude-sonnet-4-0': 200_000,
  'gemini-2.0-flash': 1_000_000,
  'gemini-1.5-pro': 1_000_000,
  'qwen2.5:3b': 32_768,
  'qwen2.5:7b': 32_768,
  'llama3.2': 128_000,
};

const DEFAULT_CONTEXT_LIMIT = Number(process.env.PARITY_CONTEXT_LIMIT ?? 32_768);
/** Leave headroom for tools + model reply */
const RESERVE_TOKENS = Number(process.env.PARITY_CONTEXT_RESERVE ?? 4_096);
/** Summarize when used tokens exceed this fraction of the budget */
const SOFT_LIMIT_RATIO = Number(process.env.PARITY_CONTEXT_SOFT_RATIO ?? 0.75);
/** Keep this many newest non-system messages after condensation */
const KEEP_RECENT = Number(process.env.PARITY_CONTEXT_KEEP_RECENT ?? 6);

const SUMMARY_MARKER = '[Parity conversation summary]';

export type ContextSnapshot = {
  sessionId: string;
  model: string;
  provider: string;
  limitTokens: number;
  reserveTokens: number;
  budgetTokens: number;
  usedTokens: number;
  remainingTokens: number;
  percentUsed: number;
  softLimitTokens: number;
  overSoftLimit: boolean;
  messageCount: number;
  estimated: true;
  condensed: boolean;
  summaryPreview?: string;
};

export function contextLimitForModel(model: string): number {
  if (MODEL_CONTEXT_LIMITS[model]) return MODEL_CONTEXT_LIMITS[model];
  const key = Object.keys(MODEL_CONTEXT_LIMITS).find((k) => model.startsWith(k));
  return key ? MODEL_CONTEXT_LIMITS[key]! : DEFAULT_CONTEXT_LIMIT;
}

/** Cheap token estimate — good enough for UI + soft limits without a tokenizer dep. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // ~4 chars/token English average; bump slightly for code-heavy tool dumps
  return Math.max(1, Math.ceil(text.length / 3.5));
}

export function estimateMessageTokens(message: Message): number {
  const roleOverhead = 4;
  const tool = message.toolName ? estimateTokens(message.toolName) : 0;
  return roleOverhead + estimateTokens(message.content) + tool;
}

export function buildContextSnapshot(input: {
  sessionId: string;
  provider: string;
  model: string;
  messages?: Message[];
}): ContextSnapshot {
  const messages = input.messages ?? listMessages(input.sessionId);
  const limitTokens = contextLimitForModel(input.model);
  const budgetTokens = Math.max(1_024, limitTokens - RESERVE_TOKENS);
  const softLimitTokens = Math.floor(budgetTokens * SOFT_LIMIT_RATIO);
  const usedTokens = messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
  const summary = [...messages].reverse().find((m) => m.role === 'system' && m.content.startsWith(SUMMARY_MARKER));

  return {
    sessionId: input.sessionId,
    model: input.model,
    provider: input.provider,
    limitTokens,
    reserveTokens: RESERVE_TOKENS,
    budgetTokens,
    usedTokens,
    remainingTokens: Math.max(0, budgetTokens - usedTokens),
    percentUsed: Math.min(100, Math.round((usedTokens / budgetTokens) * 1000) / 10),
    softLimitTokens,
    overSoftLimit: usedTokens >= softLimitTokens,
    messageCount: messages.length,
    estimated: true,
    condensed: Boolean(summary),
    summaryPreview: summary ? summary.content.slice(0, 280) : undefined,
  };
}

function formatForSummary(messages: Message[]): string {
  return messages
    .map((m) => {
      const who =
        m.role === 'user'
          ? 'User'
          : m.role === 'assistant'
            ? 'Assistant'
            : m.role === 'tool'
              ? `Tool(${m.toolName ?? 'unknown'})`
              : 'System';
      return `${who}: ${m.content.slice(0, 4000)}`;
    })
    .join('\n\n');
}

/**
 * If history exceeds the soft budget, LLM-summarize older turns and replace them
 * with a single system summary message (keeps recent turns intact).
 */
export async function maybeCondenseSession(input: {
  sessionId: string;
  provider: ProviderId;
  model: string;
  profileId?: string;
  runId?: string;
}): Promise<{ condensed: boolean; snapshot: ContextSnapshot; summary?: string }> {
  let messages = listMessages(input.sessionId);
  let snapshot = buildContextSnapshot({
    sessionId: input.sessionId,
    provider: input.provider,
    model: input.model,
    messages,
  });

  if (!snapshot.overSoftLimit) {
    return { condensed: false, snapshot };
  }

  const keep = Math.max(2, KEEP_RECENT);
  if (messages.length <= keep + 1) {
    return { condensed: false, snapshot };
  }

  const toSummarize = messages.slice(0, -keep);
  const toKeep = messages.slice(-keep);

  // Don't re-summarize if almost everything is already just a summary + recent
  const onlySummary =
    toSummarize.length === 1 &&
    toSummarize[0]!.role === 'system' &&
    toSummarize[0]!.content.startsWith(SUMMARY_MARKER);
  if (onlySummary) {
    return { condensed: false, snapshot };
  }

  const { text } = await generateText({
    model: getModelForProfile(input.profileId).model,
    system: getCondensationPrompt(),
    prompt: `Summarize this conversation for future turns. Be faithful and compact.\n\n${formatForSummary(toSummarize)}`,
    maxRetries: 2,
  });

  const summaryBody = `${SUMMARY_MARKER}\n${text.trim()}`;
  const summaryAt = Math.max(0, (toKeep[0]?.createdAt ?? Date.now()) - 1);

  MessageRepository.deleteMany(toSummarize.map((m) => m.id));
  addMessage({
    sessionId: input.sessionId,
    role: 'system',
    content: summaryBody,
    createdAt: summaryAt,
  });

  messages = listMessages(input.sessionId);

  snapshot = buildContextSnapshot({
    sessionId: input.sessionId,
    provider: input.provider,
    model: input.model,
    messages,
  });

  return { condensed: true, snapshot, summary: summaryBody };
}

/** Messages eligible for the LLM turn (system/user/assistant), after optional condensation. */
export function messagesForModel(sessionId: string): Message[] {
  return listMessages(sessionId).filter(
    (m) => m.role === 'user' || m.role === 'assistant' || m.role === 'system',
  );
}
