import { API_ROUTES } from '../../constants';
import { apiGet, apiSend } from '../client';

export type WorkspaceNode = {
  name: string;
  path: string;
  kind: 'file' | 'dir';
  size?: number;
  children?: WorkspaceNode[];
};

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

export const workspaceRepository = {
  root: () => apiGet<{ root: string }>(API_ROUTES.workspaceRoot),
  tree: (path = '.', depth = 3) =>
    apiGet<{ root: string; tree: WorkspaceNode }>(
      `${API_ROUTES.workspaceTree}?path=${encodeURIComponent(path)}&depth=${depth}`,
    ),
  readFile: (path: string) =>
    apiGet<{ path: string; content: string; truncated: boolean }>(
      `${API_ROUTES.workspaceFile}?path=${encodeURIComponent(path)}`,
    ),
  writeFile: (path: string, content: string) =>
    apiSend<{ path: string; bytes: number }>(API_ROUTES.workspaceFile, {
      method: 'PUT',
      body: { path, content },
    }),
  run: (command: string, timeoutMs?: number) =>
    apiSend<TerminalEntry>(API_ROUTES.workspaceTerminal, {
      method: 'POST',
      body: { command, timeoutMs },
    }),
  history: (limit = 40) =>
    apiGet<TerminalEntry[]>(`${API_ROUTES.workspaceTerminalHistory}?limit=${limit}`),
  git: (diff = false) =>
    apiGet<{ root: string; status: string; diff?: string }>(
      `${API_ROUTES.workspaceGit}${diff ? '?diff=1' : ''}`,
    ),
  skills: () =>
    apiGet<Array<{ name: string; description: string; triggers: string[] }>>(
      API_ROUTES.workspaceSkills,
    ),
};
