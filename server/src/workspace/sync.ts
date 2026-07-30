import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { updateSettings } from '../runtime/settings.js';
import { getWorkspaceRoot } from './paths.js';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '../../.data');
const uploadsDir = join(dataDir, 'workspaces');

const MAX_FILES = 2500;
const MAX_FILE_BYTES = 400_000;
const MAX_TOTAL_BYTES = 40_000_000;

export type SyncFile = { path: string; content: string };

function safeRelPath(input: string): string {
  const cleaned = input.replaceAll('\\', '/').replace(/^\/+/, '').trim();
  if (!cleaned || cleaned.includes('\0')) throw new Error(`Invalid path: ${input}`);
  const norm = normalize(cleaned);
  if (norm.startsWith('..') || norm.includes('/../') || norm === '..') {
    throw new Error(`Path escapes workspace: ${input}`);
  }
  return norm;
}

function slugName(name: string): string {
  const s = name.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 64);
  return s || 'workspace';
}

/**
 * OpenHands-style: frontend selected a folder and sends its files.
 * We materialize them under .data/workspaces/… and point workspaceRoot there.
 */
export function syncWorkspaceFromUpload(
  files: SyncFile[],
  opts?: { name?: string },
): { root: string; fileCount: number; bytes: number } {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('No files to sync — select a folder with readable files');
  }
  if (files.length > MAX_FILES) {
    throw new Error(`Too many files (${files.length}). Max ${MAX_FILES} (skip node_modules/.git).`);
  }

  let total = 0;
  const prepared: Array<{ rel: string; content: string }> = [];
  for (const f of files) {
    const rel = safeRelPath(String(f.path ?? ''));
    const content = String(f.content ?? '');
    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes > MAX_FILE_BYTES) continue; // skip oversized rather than fail whole sync
    total += bytes;
    if (total > MAX_TOTAL_BYTES) {
      throw new Error(`Workspace too large to sync (max ~${MAX_TOTAL_BYTES / 1_000_000}MB text)`);
    }
    prepared.push({ rel, content });
  }
  if (!prepared.length) throw new Error('No usable text files after size filters');

  const target = join(uploadsDir, `${slugName(opts?.name ?? 'workspace')}-${Date.now().toString(36)}`);
  mkdirSync(target, { recursive: true });

  for (const f of prepared) {
    const abs = join(target, f.rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, f.content, 'utf8');
  }

  updateSettings({ workspaceRoot: target });
  getWorkspaceRoot();
  return { root: target, fileCount: prepared.length, bytes: total };
}
