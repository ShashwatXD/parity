import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { getWorkspaceRoot, resolveWorkspacePath, toWorkspaceRelative } from './paths.js';

export type WorkspaceNode = {
  name: string;
  path: string;
  kind: 'file' | 'dir';
  size?: number;
  children?: WorkspaceNode[];
};

const SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.data']);

export function listWorkspaceTree(rel = '.', depth = 3): WorkspaceNode {
  const abs = resolveWorkspacePath(rel);
  const st = statSync(abs);
  const name = rel === '.' ? basename(getWorkspaceRoot()) : basename(abs);
  if (!st.isDirectory()) {
    return { name, path: toWorkspaceRelative(abs), kind: 'file', size: st.size };
  }
  return walk(abs, depth);
}

function walk(abs: string, depth: number): WorkspaceNode {
  const node: WorkspaceNode = {
    name: abs === getWorkspaceRoot() ? basename(abs) : basename(abs),
    path: toWorkspaceRelative(abs),
    kind: 'dir',
    children: [],
  };
  if (depth < 0) return node;
  let entries: string[] = [];
  try {
    entries = readdirSync(abs);
  } catch {
    return node;
  }
  for (const entry of entries.sort((a, b) => a.localeCompare(b))) {
    if (SKIP.has(entry) || entry.startsWith('.')) continue;
    const childAbs = join(abs, entry);
    let st;
    try {
      st = statSync(childAbs);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      node.children!.push(walk(childAbs, depth - 1));
    } else {
      node.children!.push({
        name: entry,
        path: toWorkspaceRelative(childAbs),
        kind: 'file',
        size: st.size,
      });
    }
  }
  return node;
}

export function readWorkspaceFile(rel: string, maxBytes = 200_000): {
  path: string;
  content: string;
  truncated: boolean;
} {
  const abs = resolveWorkspacePath(rel);
  const buf = readFileSync(abs);
  const truncated = buf.byteLength > maxBytes;
  const content = truncated ? buf.subarray(0, maxBytes).toString('utf8') : buf.toString('utf8');
  return { path: toWorkspaceRelative(abs), content, truncated };
}

export function writeWorkspaceFile(rel: string, content: string): { path: string; bytes: number } {
  const abs = resolveWorkspacePath(rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, 'utf8');
  return { path: toWorkspaceRelative(abs), bytes: Buffer.byteLength(content, 'utf8') };
}

export function strReplaceInFile(
  rel: string,
  oldStr: string,
  newStr: string,
): { path: string; replacements: number } {
  const { content } = readWorkspaceFile(rel, 2_000_000);
  if (!oldStr) throw new Error('old_str is required');
  const count = content.split(oldStr).length - 1;
  if (count === 0) throw new Error('old_str not found in file');
  if (count > 1) throw new Error(`old_str matched ${count} times — make it unique`);
  writeWorkspaceFile(rel, content.replace(oldStr, newStr));
  return { path: rel, replacements: 1 };
}
