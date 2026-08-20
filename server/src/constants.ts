export const SERVICE_NAME = 'parity-mcp-studio' as const;

export const DEFAULT_PROVIDER = 'ollama' as const;
export const DEFAULT_MODEL = 'qwen2.5:3b' as const;

export const DEFAULT_MODELS = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-latest',
  gemini: 'gemini-2.0-flash',
  ollama: 'qwen2.5:3b',
} as const;

export const ID_PREFIX = {
  session: 'session',
  message: 'msg',
  mcp: 'mcp',
  run: 'run',
  event: 'evt',
  workflow: 'wf',
  workflowRun: 'wfrun',
  artifact: 'art',
  approval: 'appr',
  job: 'job',
  memory: 'mem',
  agent: 'agent',
  team: 'team',
} as const;

/** Relative route paths mounted under `/api`. */
export const API_ROUTES = {
  health: '/health',
  sessions: '/sessions',
  session: (id: string) => `/sessions/${id}`,
  sessionContext: (id: string) => `/sessions/${id}/context`,
  search: '/search',
  mcpConnections: '/mcp/connections',
  mcpConnect: '/mcp/connect',
  mcpConnection: (id: string) => `/mcp/connections/${id}`,
  mcpTools: '/mcp/tools',
  mcpToolCall: '/mcp/tools/call',
  mcpResources: '/mcp/resources',
  mcpResourceRead: '/mcp/resources/read',
  mcpPrompts: '/mcp/prompts',
  mcpPromptGet: '/mcp/prompts/get',
  oauthStatus: '/oauth/status',
  workflows: '/workflows',
  workflowRun: (id: string) => `/workflows/${id}/run`,
  agents: '/agents',
  agent: (id: string) => `/agents/${id}`,
  teams: '/teams',
  team: (id: string) => `/teams/${id}`,
  teamRun: '/teams/run',
  approvals: '/approvals',
  approvalResolve: (id: string) => `/approvals/${id}/resolve`,
  jobs: '/jobs',
  artifacts: '/artifacts',
  plugins: '/plugins',
  observabilityEvents: '/observability/events',
  observabilityMetrics: '/observability/metrics',
  evals: '/evals',
  evalsRun: '/evals/run',
  ragStatus: '/rag/status',
  ragIndex: '/rag/index',
  ragSearch: '/rag/search',
  chat: '/chat',
  settings: '/settings',
  memories: '/memories',
  memory: (id: string) => `/memories/${id}`,
  memorySearch: '/memories/search',
  memoryGate: '/memories/gate',
  historySearch: '/history/search',
  skills: '/skills',
  workspaceRoot: '/workspace',
  workspaceTree: '/workspace/tree',
  workspaceFile: '/workspace/file',
  workspaceSync: '/workspace/sync',
  workspaceBrowse: '/workspace/browse',
  workspaceUse: '/workspace/use',
  workspacePick: '/workspace/pick',
  workspaceTerminal: '/workspace/terminal',
  workspaceTerminalHistory: '/workspace/terminal/history',
  workspaceGit: '/workspace/git',
  /** @deprecated use skills */
  workspaceSkills: '/skills',
} as const;

const LOCAL_CORS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

function corsFromEnv(): string[] {
  const raw = process.env.CORS_ORIGINS?.trim() || process.env.CORS_ORIGIN?.trim() || '';
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const CORS_ORIGINS: string[] = [...new Set([...LOCAL_CORS, ...corsFromEnv()])];

export const HEADER_RUN_ID = 'X-Parity-Run-Id';
