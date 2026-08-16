import type { MessageRole, ProviderId } from './common';

export type Session = {
  id: string;
  title: string;
  provider: string;
  model: string;
  createdAt?: number;
  updatedAt?: number;
};

/** Session list row with history intelligence fields. */
export type SessionIntelligence = Session & {
  messageCount: number;
  userMessageCount: number;
  preview: string;
  topics: string[];
  condensed: boolean;
  score?: number;
};

export type HistoryHit = {
  sessionId: string;
  sessionTitle: string;
  messageId: string;
  role: string;
  excerpt: string;
  score: number;
  createdAt: number;
};

export type HistorySearchResult = {
  query: string;
  gate: { retrieve: boolean; query: string; reason: string };
  hits: HistoryHit[];
};

export type Message = {
  id: string;
  role: MessageRole | string;
  content: string;
  toolName?: string | null;
  toolCallId?: string | null;
  tokensPrompt?: number;
  tokensCompletion?: number;
  latencyMs?: number;
  costUsd?: number;
  createdAt?: number;
};

export type SessionDetail = Session & {
  messages: Message[];
};

export type CreateSessionInput = {
  title?: string;
  provider?: ProviderId | string;
  model?: string;
};

export type ChatSendInput = {
  sessionId: string;
  message: string;
  profileId?: string;
  provider?: string;
  model?: string;
};

export type ChatSendResult = {
  response: Response;
  runId: string;
};

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
