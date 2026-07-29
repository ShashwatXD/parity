import { API_ROUTES, HEADER_RUN_ID } from '../constants';
import type {
  Approval,
  Artifact,
  BackgroundJob,
  DiscoveredPrompt,
  DiscoveredResource,
  DiscoveredTool,
  ExecutionEvent,
  McpConnectionsResponse,
  MetricsSummary,
  PluginInfo,
  SearchResult,
  Session,
  SessionDetail,
  Workflow,
} from '../models';
import { apiGet, apiSend, apiStream } from './client';

export const SessionApi = {
  list: () => apiGet<Session[]>(API_ROUTES.sessions),
  get: (id: string) => apiGet<SessionDetail>(API_ROUTES.session(id)),
  create: (body: { title?: string; provider?: string; model?: string }) =>
    apiSend<Session>(API_ROUTES.sessions, { method: 'POST', body }),
};

export const McpApi = {
  connections: () => apiGet<McpConnectionsResponse>(API_ROUTES.mcpConnections),
  connect: (body: unknown) =>
    apiSend<{ id: string }>(API_ROUTES.mcpConnect, { method: 'POST', body }),
  disconnect: (id: string) =>
    apiSend<{ ok: boolean }>(API_ROUTES.mcpConnection(id), { method: 'DELETE' }),
  tools: () => apiGet<DiscoveredTool[]>(API_ROUTES.mcpTools),
  callTool: (body: { connectionId: string; name: string; arguments: Record<string, unknown> }) =>
    apiSend<{ result: unknown; latencyMs: number }>(API_ROUTES.mcpToolCall, {
      method: 'POST',
      body,
    }),
  resources: () => apiGet<DiscoveredResource[]>(API_ROUTES.mcpResources),
  readResource: (body: { connectionId: string; uri: string }) =>
    apiSend<unknown>(API_ROUTES.mcpResourceRead, { method: 'POST', body }),
  prompts: () => apiGet<DiscoveredPrompt[]>(API_ROUTES.mcpPrompts),
};

export const WorkflowApi = {
  list: () => apiGet<Workflow[]>(API_ROUTES.workflows),
  create: (body: unknown) => apiSend<Workflow>(API_ROUTES.workflows, { method: 'POST', body }),
  run: (id: string, body: { input?: Record<string, unknown>; background?: boolean }) =>
    apiSend<{ timelineRunId?: string }>(API_ROUTES.workflowRun(id), { method: 'POST', body }),
};

export const ApprovalApi = {
  listPending: () => apiGet<Approval[]>(`${API_ROUTES.approvals}?status=pending`),
  resolve: (id: string, body: { status: 'approved' | 'rejected'; note?: string }) =>
    apiSend(API_ROUTES.approvalResolve(id), { method: 'POST', body }),
};

export const ObservabilityApi = {
  events: () => apiGet<ExecutionEvent[]>(API_ROUTES.observabilityEvents),
  metrics: () => apiGet<MetricsSummary>(API_ROUTES.observabilityMetrics),
};

export const StudioApi = {
  search: (q: string) => apiGet<SearchResult>(`${API_ROUTES.search}?q=${encodeURIComponent(q)}`),
  artifacts: () => apiGet<Artifact[]>(API_ROUTES.artifacts),
  jobs: () => apiGet<BackgroundJob[]>(API_ROUTES.jobs),
  plugins: () => apiGet<PluginInfo[]>(API_ROUTES.plugins),
};

export const ChatApi = {
  async send(body: {
    sessionId: string;
    message: string;
    provider: string;
    model: string;
  }) {
    const res = await apiStream(API_ROUTES.chat, body);
    return {
      response: res,
      runId: res.headers.get(HEADER_RUN_ID) ?? '',
    };
  },
};
