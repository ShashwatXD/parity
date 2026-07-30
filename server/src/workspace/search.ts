import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { getWorkspaceRoot, toWorkspaceRelative } from './paths.js';

const SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.data', '.DS_Store']);

function walkFiles(absDir: string, out: string[], max = 2000): void {
  if (out.length >= max) return;
  let entries: string[] = [];
  try {
    entries = readdirSync(absDir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP.has(entry)) continue;
    const abs = join(absDir, entry);
    let st;
    try {
      st = statSync(abs);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (entry.startsWith('.') && entry !== '.') continue;
      walkFiles(abs, out, max);
    } else {
      out.push(abs);
    }
  }
}

function matchGlob(relPath: string, pattern: string): boolean {
  const p = pattern.replaceAll('\\', '/');
  const path = relPath.replaceAll('\\', '/');
  // Very small glob: ** / * / ?
  const escaped = p
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '<<<DS>>>')
    .replace(/\*\*/g, '<<<D>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/<<<DS>>>/g, '(?:.*/)?')
    .replace(/<<<D>>>/g, '.*');
  return new RegExp(`^${escaped}$`, 'i').test(path);
}

export function globWorkspace(pattern: string, limit = 200): { matches: string[]; truncated: boolean } {
  const root = getWorkspaceRoot();
  const files: string[] = [];
  walkFiles(root, files);
  const matches: string[] = [];
  for (const abs of files) {
    const rel = toWorkspaceRelative(abs);
    if (matchGlob(rel, pattern) || matchGlob(rel.split('/').pop() ?? rel, pattern)) {
      matches.push(rel);
      if (matches.length >= limit) {
        return { matches, truncated: true };
      }
    }
  }
  return { matches, truncated: false };
}

export function grepWorkspace(input: {
  pattern: string;
  glob?: string;
  caseInsensitive?: boolean;
  maxMatches?: number;
}): { matches: Array<{ path: string; line: number; text: string }>; truncated: boolean } {
  const root = getWorkspaceRoot();
  const files: string[] = [];
  walkFiles(root, files);
  const maxMatches = input.maxMatches ?? 80;
  let regex: RegExp;
  try {
    regex = new RegExp(input.pattern, input.caseInsensitive ? 'i' : undefined);
  } catch {
    throw new Error(`Invalid regex: ${input.pattern}`);
  }
  const matches: Array<{ path: string; line: number; text: string }> = [];
  for (const abs of files) {
    const rel = relative(root, abs) || '.';
    if (input.glob && !matchGlob(rel, input.glob) && !matchGlob(rel.split('/').pop() ?? rel, input.glob)) {
      continue;
    }
    let content: string;
    try {
      const buf = readFileSync(abs);
      if (buf.includes(0)) continue; // skip binary
      content = buf.toString('utf8');
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i] ?? '';
      if (regex.test(text)) {
        matches.push({ path: toWorkspaceRelative(abs), line: i + 1, text: text.slice(0, 400) });
        if (matches.length >= maxMatches) {
          return { matches, truncated: true };
        }
      }
    }
  }
  return { matches, truncated: false };
}
