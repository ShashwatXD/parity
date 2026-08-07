export type GroundingContext = {
  path: string;
  startLine: number;
  endLine: number;
  content: string;
};

export type Citation = {
  raw: string;
  path: string;
  startLine: number | null;
  endLine: number | null;
};

export type ClaimScore = {
  claim: string;
  supported: boolean;
  overlap: number;
};

export type GroundednessReport = {
  score: number;
  supportScore: number;
  citationScore: number | null;
  claims: ClaimScore[];
  unsupported: string[];
  citations: {
    total: number;
    valid: number;
    invalid: Citation[];
  };
  summary: string;
};

/**
 * Words carry no evidentiary weight, so counting them inflates overlap against
 * any sufficiently long context.
 */
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'can', 'do', 'does', 'for',
  'from', 'has', 'have', 'how', 'in', 'is', 'it', 'its', 'not', 'of', 'on', 'or', 'that', 'the',
  'their', 'then', 'there', 'these', 'they', 'this', 'to', 'was', 'were', 'what', 'when', 'where',
  'which', 'will', 'with', 'you', 'your',
]);

const CITATION_RE = /([A-Za-z0-9_@./-]+\.[A-Za-z]{1,6})(?::(\d+)(?:\s*[-–]\s*(\d+))?)?/g;

/** Crude suffix stripping so prose ("inserted") matches code ("insert"). */
function stem(token: string): string {
  if (token.length > 5 && token.endsWith('ing')) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith('ed')) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s')) return token.slice(0, -1);
  return token;
}

/**
 * Identifiers hide the words an answer refers to, so resolveEmbeddingConfig has
 * to yield "resolve", "embedding" and "config" for prose to match it at all.
 */
function expandIdentifier(raw: string): string[] {
  const parts = raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((p) => p.toLowerCase());
  const expanded = new Set(parts);
  if (parts.length > 1) expanded.add(parts.join(''));
  return [...expanded];
}

function contentWords(text: string): string[] {
  const words: string[] = [];
  for (const raw of text.split(/[^A-Za-z0-9_]+/)) {
    if (!raw) continue;
    for (const part of expandIdentifier(raw)) {
      if (part.length > 1 && !STOPWORDS.has(part)) words.push(stem(part));
    }
  }
  return words;
}

/** Split prose into claim-sized units: sentences, list items, and lines. */
export function splitClaims(answer: string): string[] {
  return answer
    .split('\n')
    .flatMap((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter((s) => contentWords(s).length >= 3);
}

export function extractCitations(answer: string): Citation[] {
  const found: Citation[] = [];
  const seen = new Set<string>();
  for (const match of answer.matchAll(CITATION_RE)) {
    const raw = match[0];
    if (seen.has(raw)) continue;
    seen.add(raw);
    found.push({
      raw,
      path: match[1] ?? '',
      startLine: match[2] ? Number(match[2]) : null,
      endLine: match[3] ? Number(match[3]) : null,
    });
  }
  return found;
}

function matchesContextPath(citationPath: string, contextPath: string): boolean {
  if (citationPath === contextPath) return true;
  return contextPath.endsWith(`/${citationPath}`) || citationPath.endsWith(`/${contextPath}`);
}

/**
 * A citation is valid when the file appears in the retrieved context and any
 * cited line falls inside a chunk that was actually retrieved for that file.
 */
export function validateCitation(citation: Citation, contexts: GroundingContext[]): boolean {
  const forPath = contexts.filter((c) => matchesContextPath(citation.path, c.path));
  if (!forPath.length) return false;
  if (citation.startLine === null) return true;
  const start = citation.startLine;
  const end = citation.endLine ?? citation.startLine;
  return forPath.some((c) => start >= c.startLine && end <= c.endLine);
}

/**
 * Heuristic faithfulness check: how much of an answer is recoverable from the
 * context the agent was actually given. Lexical rather than model-graded, so it
 * is deterministic and runnable in CI without an API key.
 */
export function scoreGroundedness(input: {
  answer: string;
  contexts: GroundingContext[];
  threshold?: number;
}): GroundednessReport {
  const threshold = input.threshold ?? 0.6;
  const claims = splitClaims(input.answer);
  const contextVocabulary = new Set(contentWords(input.contexts.map((c) => c.content).join('\n')));

  const scored: ClaimScore[] = claims.map((claim) => {
    const words = contentWords(claim);
    const hits = words.filter((w) => contextVocabulary.has(w)).length;
    const overlap = words.length ? hits / words.length : 0;
    return { claim, supported: overlap >= threshold, overlap: Number(overlap.toFixed(3)) };
  });

  const citations = extractCitations(input.answer);
  const invalid = citations.filter((c) => !validateCitation(c, input.contexts));

  const supportScore = scored.length
    ? scored.filter((c) => c.supported).length / scored.length
    : 0;
  const citationScore = citations.length
    ? (citations.length - invalid.length) / citations.length
    : null;

  // Unsupported claims are the failure mode that matters, so support dominates.
  const combined = citationScore === null ? supportScore : supportScore * 0.7 + citationScore * 0.3;
  const score = Math.round(combined * 100);
  const unsupported = scored.filter((c) => !c.supported).map((c) => c.claim);

  const citationNote =
    citationScore === null
      ? 'no citations found'
      : `${citations.length - invalid.length}/${citations.length} citations valid`;

  return {
    score,
    supportScore: Number(supportScore.toFixed(3)),
    citationScore: citationScore === null ? null : Number(citationScore.toFixed(3)),
    claims: scored,
    unsupported,
    citations: { total: citations.length, valid: citations.length - invalid.length, invalid },
    summary: `Groundedness ${score}/100 — ${scored.length - unsupported.length}/${scored.length} claims supported, ${citationNote}.`,
  };
}
