import type { WORKSPACE_TABS } from './constants';

export type WorkspaceTab = (typeof WORKSPACE_TABS)[number];

export type ProviderId = 'openai' | 'anthropic' | 'gemini' | 'ollama';

export type Session = {
  id: string;
  title: string;
  provider: string;
  model: string;
};

export type Message = {
  id: string;
  role: string;
  content: string;
  toolName?: string | null;
};

export type SessionDetail = Session & {
  messages: Message[];
};

export type McpConnection = {
  id: string;
  name: string;
  transport: string;
  status: string;
};

export type McpConnectionsResponse = {
  live: McpConnection[];
  saved: McpConnection[];
};

export type DiscoveredTool = {
  connectionId: string;
  connectionName: string;
  name: string;
  description: string;
  inputSchema?: unknown;
};

export type DiscoveredResource = {
  connectionId: string;
  connectionName: string;
  uri: string;
  name: string;
  description: string;
};

export type DiscoveredPrompt = {
  connectionId: string;
  connectionName: string;
  name: string;
  description: string;
};

export type ExecutionEvent = {
  id: string;
  runId: string;
  kind: string;
  label: string;
  status: string;
  latencyMs: number;
  tokensPrompt: number;
  tokensCompletion: number;
  createdAt: number;
};

export type MetricsSummary = {
  events: number;
  totalLatencyMs: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
};

export type Workflow = {
  id: string;
  name: string;
  description?: string;
  graphJson?: string;
};

export type Approval = {
  id: string;
  toolName: string;
  status: string;
};

export type Artifact = {
  id: string;
  title: string;
  kind: string;
};

export type BackgroundJob = Record<string, unknown>;

export type PluginInfo = {
  name: string;
  version: string;
};

export type SearchResult = {
  query: string;
  sessions: Session[];
  connections: McpConnection[];
  tools: DiscoveredTool[];
  resources: DiscoveredResource[];
  prompts: DiscoveredPrompt[];
};

export type ApiErrorBody = {
  error?: string;
};
