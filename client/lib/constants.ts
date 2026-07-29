export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5005/api';

export const DEFAULT_PROVIDER = 'ollama' as const;

export const DEFAULT_MODELS = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-latest',
  gemini: 'gemini-2.0-flash',
  ollama: 'qwen2.5:3b',
} as const;

export const WORKSPACE_TABS = [
  'chat',
  'servers',
  'tools',
  'playground',
  'resources',
  'prompts',
  'workflows',
  'observability',
] as const;

export const API_ROUTES = {
  health: '/health',
  sessions: '/sessions',
  session: (id: string) => `/sessions/${id}`,
  search: '/search',
  mcpConnections: '/mcp/connections',
  mcpConnect: '/mcp/connect',
  mcpConnection: (id: string) => `/mcp/connections/${id}`,
  mcpTools: '/mcp/tools',
  mcpToolCall: '/mcp/tools/call',
  mcpResources: '/mcp/resources',
  mcpResourceRead: '/mcp/resources/read',
  mcpPrompts: '/mcp/prompts',
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
} as const;

export const HEADER_RUN_ID = 'X-Parity-Run-Id';

export const DEFAULT_MCP = {
  name: 'filesystem',
  transport: 'stdio' as const,
  command: 'npx',
  args: '-y @modelcontextprotocol/server-filesystem /tmp',
  url: 'http://127.0.0.1:3001/mcp',
};
