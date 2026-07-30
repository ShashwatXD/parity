import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSettings } from '../runtime/settings.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultRoot = join(__dirname, '../../.data/workspace');

const DEFAULT_README = `# Parity workspace

This directory is the agent sandbox. The coding agent can read/write files, run shell commands, search code, and inspect git here.

Set a custom root in Settings → Workspace, or via \`PARITY_WORKSPACE\`.
`;

export function getWorkspaceRoot(): string {
  const fromSettings = getSettings().workspaceRoot?.trim();
  const fromEnv = process.env.PARITY_WORKSPACE?.trim();
  const root = fromSettings || fromEnv || defaultRoot;
  mkdirSync(root, { recursive: true });
  const readme = join(root, 'README.md');
  if (!existsSync(readme) && root === resolve(defaultRoot)) {
    writeFileSync(readme, DEFAULT_README, 'utf8');
  }
  return resolve(root);
}

/** Resolve a user/agent path and ensure it stays inside the workspace. */
export function resolveWorkspacePath(inputPath = '.'): string {
  const root = getWorkspaceRoot();
  const cleaned = inputPath.replaceAll('\\', '/').trim() || '.';
  const abs = isAbsolute(cleaned) ? resolve(cleaned) : resolve(root, cleaned);
  const normalized = normalize(abs);
  const rel = relative(root, normalized);
  if (rel.startsWith('..') || rel === '..' || normalized === root + sep + '..') {
    throw new Error(`Path escapes workspace: ${inputPath}`);
  }
  if (!normalized.startsWith(root) && normalized !== root) {
    // Windows drive edge cases — compare realpath-ish
    const rootWithSep = root.endsWith(sep) ? root : root + sep;
    if (normalized !== root && !normalized.startsWith(rootWithSep)) {
      throw new Error(`Path escapes workspace: ${inputPath}`);
    }
  }
  return normalized;
}

export function toWorkspaceRelative(absPath: string): string {
  const root = getWorkspaceRoot();
  const rel = relative(root, absPath);
  return rel || '.';
}
