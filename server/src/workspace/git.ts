import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getWorkspaceRoot } from './paths.js';

const execFileAsync = promisify(execFile);

async function git(args: string[]): Promise<string> {
  const cwd = getWorkspaceRoot();
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd,
      timeout: 20_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    return String(stdout);
  } catch (error) {
    const err = error as { stderr?: string; message?: string };
    throw new Error(String(err.stderr || err.message || 'git failed'));
  }
}

export async function gitStatus(): Promise<{ root: string; status: string }> {
  const root = getWorkspaceRoot();
  try {
    const status = await git(['status', '--short', '--branch']);
    return { root, status: status || '(clean)' };
  } catch (e) {
    return {
      root,
      status: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function gitDiff(staged = false): Promise<{ root: string; diff: string }> {
  const root = getWorkspaceRoot();
  const args = staged ? ['diff', '--cached'] : ['diff'];
  try {
    const diff = await git(args);
    return { root, diff: diff.slice(0, 100_000) || '(no diff)' };
  } catch (e) {
    return {
      root,
      diff: e instanceof Error ? e.message : String(e),
    };
  }
}
