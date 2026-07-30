export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5005/api';

export const HEADER_RUN_ID = 'X-Parity-Run-Id';

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
