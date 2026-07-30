export type McpTransport = 'stdio' | 'http';

export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | string;

export type McpConnection = {
  id: string;
  name: string;
  transport: string;
  status: ConnectionStatus;
  lastError?: string | null;
  createdAt?: number;
  updatedAt?: number;
};

export type McpConnectionsResponse = {
  live: McpConnection[];
  saved: McpConnection[];
};

export type McpStdioConfig = {
  command: string;
  args: string[];
  env?: Record<string, string>;
};

export type McpHttpConfig = {
  url: string;
  headers?: Record<string, string>;
};

export type McpConnectInput =
  | {
      name: string;
      transport: 'stdio';
      config: McpStdioConfig;
    }
  | {
      name: string;
      transport: 'http';
      config: McpHttpConfig;
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

export type ToolCallInput = {
  connectionId: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type ToolCallResult = {
  result: unknown;
  latencyMs: number;
};
