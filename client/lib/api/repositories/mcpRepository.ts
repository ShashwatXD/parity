import { API_ROUTES } from '../../constants';
import type {
  DiscoveredPrompt,
  DiscoveredResource,
  DiscoveredTool,
  McpConnectInput,
  McpConnectionsResponse,
  ToolCallInput,
  ToolCallResult,
} from '../../models';
import { apiGet, apiSend } from '../client';

export const mcpRepository = {
  connections: () => apiGet<McpConnectionsResponse>(API_ROUTES.mcpConnections),

  connect: (body: McpConnectInput) =>
    apiSend<{ id: string }>(API_ROUTES.mcpConnect, { method: 'POST', body }),

  disconnect: (id: string) =>
    apiSend<{ ok: boolean }>(API_ROUTES.mcpConnection(id), { method: 'DELETE' }),

  tools: (connectionId?: string) =>
    apiGet<DiscoveredTool[]>(
      connectionId
        ? `${API_ROUTES.mcpTools}?connectionId=${encodeURIComponent(connectionId)}`
        : API_ROUTES.mcpTools,
    ),

  callTool: (body: ToolCallInput) =>
    apiSend<ToolCallResult>(API_ROUTES.mcpToolCall, { method: 'POST', body }),

  resources: () => apiGet<DiscoveredResource[]>(API_ROUTES.mcpResources),

  readResource: (body: { connectionId: string; uri: string }) =>
    apiSend<unknown>(API_ROUTES.mcpResourceRead, { method: 'POST', body }),

  prompts: () => apiGet<DiscoveredPrompt[]>(API_ROUTES.mcpPrompts),

  getPrompt: (body: { connectionId: string; name: string; arguments?: Record<string, unknown> }) =>
    apiSend<unknown>(API_ROUTES.mcpPromptGet, { method: 'POST', body }),
};
