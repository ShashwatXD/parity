import type {
  DiscoveredPrompt,
  DiscoveredResource,
  DiscoveredTool,
  McpConnection,
} from './mcp';
import type { Session } from './session';

export type ExecutionEvent = {
  id: string;
  runId: string;
  kind: string;
  label: string;
  status: string;
  latencyMs: number;
  tokensPrompt: number;
  tokensCompletion: number;
  costUsd?: number;
  createdAt: number;
  sessionId?: string | null;
  detailJson?: string | null;
};

export type MetricsSummary = {
  events: number;
  totalLatencyMs: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
};

export type SearchResult = {
  query: string;
  sessions: Session[];
  connections: McpConnection[];
  tools: DiscoveredTool[];
  resources: DiscoveredResource[];
  prompts: DiscoveredPrompt[];
};
