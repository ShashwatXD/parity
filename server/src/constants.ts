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
  approvals: '/approvals',
  approvalResolve: (id: string) => `/approvals/${id}/resolve`,
  jobs: '/jobs',
  artifacts: '/artifacts',
  plugins: '/plugins',
  observabilityEvents: '/observability/events',
  observabilityMetrics: '/observability/metrics',
  chat: '/chat',
  settings: '/settings',
  workspaceRoot: '/workspace',
  workspaceTree: '/workspace/tree',
  workspaceFile: '/workspace/file',
  workspaceTerminal: '/workspace/terminal',
  workspaceTerminalHistory: '/workspace/terminal/history',
  workspaceGit: '/workspace/git',
  workspaceSkills: '/workspace/skills',
} as const;

export const CORS_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
] as const;

export const HEADER_RUN_ID = 'X-Parity-Run-Id';
