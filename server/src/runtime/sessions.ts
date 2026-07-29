import { MessageRepository, SessionRepository } from '../repositories/sessionRepository.js';
import type { Message, MessageRole, ProviderId, Session } from '../models.js';

export function createSession(input?: {
  title?: string;
  provider?: ProviderId;
  model?: string;
}): Session {
  return SessionRepository.create(input);
}

export function listSessions(): Session[] {
  return SessionRepository.list();
}

export function getSession(id: string): Session | undefined {
  return SessionRepository.getById(id);
}

export function deleteSession(id: string): boolean {
  return SessionRepository.delete(id);
}

export function listMessages(sessionId: string): Message[] {
  return MessageRepository.listBySession(sessionId);
}

export function addMessage(input: {
  sessionId: string;
  role: MessageRole;
  content: string;
  toolName?: string;
  toolCallId?: string;
  tokensPrompt?: number;
  tokensCompletion?: number;
  latencyMs?: number;
  costUsd?: number;
}): Message {
  return MessageRepository.create(input);
}
