import { existsSync, lstatSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, normalize, resolve, sep } from 'node:path';
import { homedir } from 'node:os';
import { updateSettings } from '../runtime/settings.js';
import { getWorkspaceRoot } from './paths.js';

const SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.data', '.Trash']);

export type BrowseEntry = {
  name: string;
  path: string;
  kind: 'file' | 'dir';
};

function resolveBrowsePath(input?: string): string {
  const raw = (input ?? '').trim();
  if (!raw || raw === '~') return homedir();
  if (raw.startsWith('~/')) return join(homedir(), raw.slice(2));
  if (!isAbsolute(raw)) return resolve(homedir(), raw);
  return resolve(raw);
}

/** List a directory on the API host (OpenHands-style workspace picker). */
export function browseHostDirectory(inputPath?: string): {
  path: string;
  parent: string | null;
  entries: BrowseEntry[];
} {
  const path = resolveBrowsePath(inputPath);
  if (!existsSync(path)) throw new Error(`Path does not exist: ${path}`);
  const st = lstatSync(path);
  if (!st.isDirectory()) throw new Error(`Not a directory: ${path}`);

  const parentDir = dirname(path);
  const parent = parentDir !== path ? parentDir : null;

  const entries: BrowseEntry[] = [];
  for (const name of readdirSync(path).sort((a, b) => a.localeCompare(b))) {
    if (SKIP.has(name)) continue;
    if (name === '.' || name === '..') continue;
    const child = join(path, name);
    let kind: 'file' | 'dir' = 'file';
    try {
      const cst = lstatSync(child);
      if (cst.isSymbolicLink()) continue;
      kind = cst.isDirectory() ? 'dir' : 'file';
    } catch {
      continue;
    }
    entries.push({ name, path: child, kind });
  }

  return { path, parent, entries };
}

/** Point the agent sandbox at an existing directory on the API host (no copy). */
export function useHostDirectory(inputPath: string): { root: string } {
  const path = resolveBrowsePath(inputPath);
  if (!existsSync(path)) throw new Error(`Path does not exist: ${path}`);
  const st = statSync(path);
  if (!st.isDirectory()) throw new Error(`Not a directory: ${path}`);
  // Normalize and ensure we can create marker access
  const root = normalize(path);
  mkdirSync(root, { recursive: true });
  updateSettings({ workspaceRoot: root });
  getWorkspaceRoot();
  return { root: resolve(root) };
}

export function workspaceSep(): string {
  return sep;
}
