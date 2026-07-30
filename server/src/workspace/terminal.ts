import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getWorkspaceRoot } from './paths.js';

const execFileAsync = promisify(execFile);

export type TerminalEntry = {
  id: string;
  command: string;
  cwd: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  createdAt: number;
  durationMs: number;
};

const history: TerminalEntry[] = [];
const MAX_HISTORY = 80;

export function listTerminalHistory(limit = 40): TerminalEntry[] {
  return history.slice(-limit);
}

export async function runInWorkspace(input: {
  command: string;
  timeoutMs?: number;
}): Promise<TerminalEntry> {
  const cwd = getWorkspaceRoot();
  const command = input.command.trim();
  if (!command) throw new Error('command is required');
  const timeoutMs = Math.min(Math.max(input.timeoutMs ?? 30_000, 1_000), 120_000);
  const started = Date.now();
  const entry: TerminalEntry = {
    id: `term_${crypto.randomUUID()}`,
    command,
    cwd,
    stdout: '',
    stderr: '',
    exitCode: null,
    timedOut: false,
    createdAt: started,
    durationMs: 0,
  };

  try {
    const { stdout, stderr } = await execFileAsync('/bin/zsh', ['-lc', command], {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, PWD: cwd },
    });
    entry.stdout = String(stdout).slice(0, 50_000);
    entry.stderr = String(stderr).slice(0, 20_000);
    entry.exitCode = 0;
  } catch (error) {
    const err = error as {
      killed?: boolean;
      code?: number | string;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    entry.timedOut = Boolean(err.killed);
    entry.stdout = String(err.stdout ?? '').slice(0, 50_000);
    entry.stderr = String(err.stderr ?? err.message ?? 'command failed').slice(0, 20_000);
    entry.exitCode = typeof err.code === 'number' ? err.code : 1;
  }

  entry.durationMs = Date.now() - started;
  history.push(entry);
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
  return entry;
}
