/**
 * search_web — live public web search for the agent loop.
 * Default: DuckDuckGo HTML (no key). Better: Tavily when TAVILY_API_KEY is set.
 */

export type WebSearchHit = {
  title: string;
  snippet: string;
  url: string;
};

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseDuckDuckGoHtml(page: string, maxResults: number): WebSearchHit[] {
  const linkRe = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snipRe = /class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|td|div)>/gi;
  const links: Array<{ href: string; title: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(page)) !== null) {
    links.push({ href: m[1], title: stripHtml(m[2]) });
  }
  const snips: string[] = [];
  while ((m = snipRe.exec(page)) !== null) {
    snips.push(stripHtml(m[1]));
  }

  const out: WebSearchHit[] = [];
  for (let i = 0; i < Math.min(links.length, maxResults); i++) {
    let url = links[i].href;
    try {
      const u = new URL(url, 'https://duckduckgo.com');
      const uddg = u.searchParams.get('uddg');
      if (uddg) url = decodeURIComponent(uddg);
      else url = u.toString();
    } catch {
      // keep raw href
    }
    out.push({
      title: links[i].title || url,
      snippet: snips[i] ?? '',
      url,
    });
  }
  return out;
}

async function searchTavily(query: string, key: string, maxResults: number): Promise<WebSearchHit[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: key,
      query,
      max_results: maxResults,
      include_answer: true,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`Tavily HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    answer?: string;
    results?: Array<{ title?: string; content?: string; url?: string }>;
  };
  const hits = (data.results ?? []).slice(0, maxResults).map((r) => ({
    title: r.title ?? '',
    snippet: (r.content ?? '').slice(0, 400),
    url: r.url ?? '',
  }));
  if (data.answer?.trim()) {
    hits.unshift({
      title: 'Tavily summary',
      snippet: data.answer.trim().slice(0, 600),
      url: '',
    });
  }
  return hits;
}

async function searchDuckDuckGo(query: string, maxResults: number): Promise<WebSearchHit[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`DuckDuckGo HTTP ${res.status}`);
  }
  const page = await res.text();
  return parseDuckDuckGoHtml(page, maxResults);
}

export function formatWebResults(query: string, engine: string, hits: WebSearchHit[]): string {
  if (!hits.length) {
    return `No web results for '${query}' via ${engine}.`;
  }
  const lines = [`Web results for '${query}' (via ${engine}):`];
  hits.forEach((h, i) => {
    lines.push(`${i + 1}. ${h.title}`);
    if (h.snippet) lines.push(`   ${h.snippet}`);
    if (h.url) lines.push(`   ${h.url}`);
  });
  return lines.join('\n');
}

export async function searchWeb(query: string, maxResults = 5): Promise<string> {
  const trimmed = query.trim();
  if (!trimmed) return 'ERROR: query is required';

  const limit = Math.min(Math.max(maxResults || 5, 1), 10);
  const key = process.env.TAVILY_API_KEY?.trim() || process.env.PARITY_SEARCH_API_KEY?.trim();

  try {
    if (key) {
      const hits = await searchTavily(trimmed, key, limit);
      return formatWebResults(trimmed, 'Tavily', hits);
    }

    const hits = await searchDuckDuckGo(trimmed, limit);
    if (!hits.length) {
      return [
        'No results — DuckDuckGo often blocks automated requests.',
        'For reliable live search set a free TAVILY_API_KEY in .env (https://tavily.com).',
        'Tell the user you could not reach the web and ask them to add the key, or try again.',
      ].join(' ');
    }
    return formatWebResults(trimmed, 'DuckDuckGo', hits);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (key) {
      return `Web search failed (${message}). Answer from what you know, or ask the user to check a finance site.`;
    }
    return [
      `Web search failed (${message}).`,
      'DuckDuckGo HTML is flaky for bots — set TAVILY_API_KEY in .env for reliable search (https://tavily.com).',
    ].join(' ');
  }
}
