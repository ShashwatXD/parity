export type ProviderId = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'custom';

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export type McpTransport = 'stdio' | 'http';

export type ConnectionStatus = 'connected' | 'disconnected' | 'error';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export type ArtifactKind = 'markdown' | 'json' | 'text' | 'report';

export type MemoryKind = 'fact' | 'episode';

export type UserMemory = {
  id: string;
  kind: MemoryKind;
  subject: string;
  content: string;
  happenedAt: string | null;
  source: string;
  createdAt: number;
  updatedAt: number;
};

export type RetrievalGateDecision = {
  retrieve: boolean;
  query: string;
  reason: string;
};

export type Session = {
  id: string;
  title: string;
  provider: ProviderId;
  model: string;
  createdAt: number;
  updatedAt: number;
};

export type Message = {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  toolName: string | null;
  toolCallId: string | null;
  tokensPrompt: number;
  tokensCompletion: number;
  latencyMs: number;
  costUsd: number;
  createdAt: number;
};

export type McpConnection = {
  id: string;
  name: string;
  transport: McpTransport;
  configJson: string;
  status: ConnectionStatus;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
};

export type ExecutionEvent = {
  id: string;
  runId: string;
  sessionId: string | null;
  kind: string;
  label: string;
  detailJson: string | null;
  status: string;
  latencyMs: number;
  tokensPrompt: number;
  tokensCompletion: number;
  costUsd: number;
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
  description: string;
  graphJson: string;
  createdAt: number;
  updatedAt: number;
};

export type WorkflowRun = {
  id: string;
  workflowId: string;
  status: string;
  inputJson: string;
  outputJson: string | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
};

export type Artifact = {
  id: string;
  runId: string | null;
  sessionId: string | null;
  title: string;
  kind: ArtifactKind;
  content: string;
  createdAt: number;
};

export type Approval = {
  id: string;
  runId: string;
  toolName: string;
  argsJson: string;
  status: ApprovalStatus;
  decisionNote: string | null;
  createdAt: number;
  resolvedAt: number | null;
};

export type BackgroundJob = {
  id: string;
  kind: string;
  payloadJson: string;
  status: JobStatus;
  resultJson: string | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
};

export type DiscoveredTool = {
  connectionId: string;
  connectionName: string;
  name: string;
  description: string;
  inputSchema: unknown;
};

export type DiscoveredResource = {
  connectionId: string;
  connectionName: string;
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
};

export type DiscoveredPrompt = {
  connectionId: string;
  connectionName: string;
  name: string;
  description: string;
  arguments: unknown[];
};

/** @deprecated Use Session */
export type SessionRow = Session;
/** @deprecated Use Message */
export type MessageRow = Message;
/** @deprecated Use McpConnection */
export type McpConnectionRow = McpConnection;
