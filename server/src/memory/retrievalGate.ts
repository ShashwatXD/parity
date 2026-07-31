/**
 * Retrieval gate — decide WHETHER to pull user memory into this turn.
 * Inspired by waku-agent: skip pure math/smalltalk so irrelevant facts don't bias answers.
 * Heuristic (deterministic) so tests and offline runs stay reliable.
 */
import type { RetrievalGateDecision } from '../models.js';

const SKIP_PATTERNS: RegExp[] = [
  /^(hi|hello|hey|thanks|thank you|ok|okay|yo|sup)[\s!.?]*$/i,
  /what('?s| is)\s+\d+\s*[\+\-\*\/x×]\s*\d+/i,
  /^(calculate|compute|solve)\b/i,
  /^\d+\s*[\+\-\*\/x×]\s*\d+\s*[=?]?\s*$/,
];

const RETRIEVE_PATTERNS: RegExp[] = [
  /\b(remember|prefers?|preference|always|never forget|my name|i am|i'm)\b/i,
  /\b(when (am|are|do|did) (i|we)|schedule|meeting|calendar|last time)\b/i,
  /\b(what do you know about|what did (i|we)|recall|you (know|remember))\b/i,
  /\b(prefer|favorite|favourite|usually|tend to)\b/i,
];

export function shouldRetrieveMemory(message: string): RetrievalGateDecision {
  const trimmed = message.trim();
  if (!trimmed) {
    return { retrieve: false, query: '', reason: 'empty message' };
  }

  for (const re of SKIP_PATTERNS) {
    if (re.test(trimmed)) {
      return { retrieve: false, query: '', reason: 'skip — no personal context needed' };
    }
  }

  for (const re of RETRIEVE_PATTERNS) {
    if (re.test(trimmed)) {
      return { retrieve: true, query: trimmed, reason: 'retrieve — references user context' };
    }
  }

  // Short technical / code-only prompts without personal cues → skip
  if (trimmed.length < 40 && !/\b(i|me|my|we|our|prefer|remember)\b/i.test(trimmed)) {
    return { retrieve: false, query: '', reason: 'skip — short impersonal prompt' };
  }

  // Fail open for longer prompts that might need context
  return { retrieve: true, query: trimmed, reason: 'retrieve — may need prior context' };
}
