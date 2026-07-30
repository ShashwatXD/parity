const CODE_EXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.md',
  '.mdx',
  '.json',
  '.yml',
  '.yaml',
  '.toml',
  '.css',
  '.scss',
  '.html',
  '.sql',
  '.sh',
  '.zsh',
  '.bash',
  '.txt',
]);

export type TextChunk = {
  path: string;
  startLine: number;
  endLine: number;
  content: string;
};

export function isIndexablePath(relPath: string): boolean {
  const lower = relPath.toLowerCase();
  if (lower.includes('node_modules/') || lower.includes('/.git/') || lower.includes('/dist/')) {
    return false;
  }
  const dot = lower.lastIndexOf('.');
  if (dot < 0) return false;
  return CODE_EXT.has(lower.slice(dot));
}

/** Split file text into overlapping line windows for retrieval. */
export function chunkText(
  path: string,
  text: string,
  opts?: { maxLines?: number; overlap?: number },
): TextChunk[] {
  const maxLines = opts?.maxLines ?? 40;
  const overlap = opts?.overlap ?? 8;
  const lines = text.split(/\r?\n/);
  if (!lines.length || (lines.length === 1 && !lines[0])) return [];

  const chunks: TextChunk[] = [];
  let i = 0;
  while (i < lines.length) {
    const start = i;
    const end = Math.min(lines.length, i + maxLines);
    const slice = lines.slice(start, end).join('\n');
    if (slice.trim()) {
      chunks.push({
        path,
        startLine: start + 1,
        endLine: end,
        content: slice,
      });
    }
    if (end >= lines.length) break;
    i = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((t) => t.length > 1);
}
