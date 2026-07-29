import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { z } from 'zod';
import { createId } from '../lib/ids.js';
import { McpConnectionRepository } from '../repositories/mcpConnectionRepository.js';

export const stdioConfigSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).optional(),
  cwd: z.string().optional(),
});

export const httpConfigSchema = z.object({
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
});

export const connectInputSchema = z.discriminatedUnion('transport', [
  z.object({
    name: z.string().min(1),
    transport: z.literal('stdio'),
    config: stdioConfigSchema,
  }),
  z.object({
    name: z.string().min(1),
    transport: z.literal('http'),
    config: httpConfigSchema,
  }),
]);

export type ConnectInput = z.infer<typeof connectInputSchema>;

function mergeProcessEnv(extra?: Record<string, string>): Record<string, string> | undefined {
  if (!extra || Object.keys(extra).length === 0) return undefined;
  const base: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) base[key] = value;
  }
  return { ...base, ...extra };
}

function withGithubAuthHeaders(headers?: Record<string, string>): Record<string, string> | undefined {
  const next = { ...(headers ?? {}) };
  if (!next.Authorization && process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
    next.Authorization = `Bearer ${process.env.GITHUB_PERSONAL_ACCESS_TOKEN}`;
  }
  return Object.keys(next).length ? next : undefined;
}

type LiveConnection = {
  id: string;
  name: string;
  transport: 'stdio' | 'http';
  client: Client;
};

function persistConnection(row: {
  id: string;
  name: string;
  transport: 'stdio' | 'http';
  configJson: string;
  status: 'connected' | 'disconnected' | 'error';
  lastError: string | null;
}) {
  McpConnectionRepository.upsert(row);
}

export class McpManager {
  private readonly live = new Map<string, LiveConnection>();

  listLive() {
    return [...this.live.values()].map(({ id, name, transport }) => ({
      id,
      name,
      transport,
      status: 'connected' as const,
    }));
  }

  async connect(input: ConnectInput) {
    const id = createId('mcp');
    const client = new Client({ name: 'parity-mcp-studio', version: '0.1.0' });
    const configJson = JSON.stringify(input.config);

    try {
      if (input.transport === 'stdio') {
        const transport = new StdioClientTransport({
          command: input.config.command,
          args: input.config.args,
          env: mergeProcessEnv(input.config.env),
          cwd: input.config.cwd,
        });
        await client.connect(transport);
      } else {
        const transport = new StreamableHTTPClientTransport(new URL(input.config.url), {
          requestInit: {
            headers: withGithubAuthHeaders(input.config.headers),
          },
        });
        await client.connect(transport);
      }

      persistConnection({
        id,
        name: input.name,
        transport: input.transport,
        configJson,
        status: 'connected',
        lastError: null,
      });

      this.live.set(id, {
        id,
        name: input.name,
        transport: input.transport,
        client,
      });

      const tools = await this.listTools(id);
      return { id, name: input.name, transport: input.transport, tools };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      persistConnection({
        id,
        name: input.name,
        transport: input.transport,
        configJson,
        status: 'error',
        lastError: message,
      });
      throw error;
    }
  }

  async disconnect(id: string) {
    const live = this.live.get(id);
    if (live) {
      await live.client.close();
      this.live.delete(id);
    }
    McpConnectionRepository.setStatus(id, 'disconnected');
  }

  getClient(id: string) {
    const live = this.live.get(id);
    if (!live) throw new Error(`MCP connection not found or not connected: ${id}`);
    return live.client;
  }

  async listTools(connectionId?: string) {
    const targets = connectionId
      ? [this.getLiveOrThrow(connectionId)]
      : [...this.live.values()];

    const tools = [];
    for (const conn of targets) {
      const result = await conn.client.listTools();
      for (const tool of result.tools) {
        tools.push({
          connectionId: conn.id,
          connectionName: conn.name,
          name: tool.name,
          description: tool.description ?? '',
          inputSchema: tool.inputSchema,
        });
      }
    }
    return tools;
  }

  async callTool(connectionId: string, name: string, args: Record<string, unknown>) {
    const client = this.getClient(connectionId);
    return client.callTool({ name, arguments: args });
  }

  async listResources(connectionId?: string) {
    const targets = connectionId
      ? [this.getLiveOrThrow(connectionId)]
      : [...this.live.values()];
    const resources = [];
    for (const conn of targets) {
      try {
        const result = await conn.client.listResources();
        for (const resource of result.resources) {
          resources.push({
            connectionId: conn.id,
            connectionName: conn.name,
            uri: resource.uri,
            name: resource.name,
            description: resource.description ?? '',
            mimeType: resource.mimeType,
          });
        }
      } catch {
        // Server may not implement resources.
      }
    }
    return resources;
  }

  async readResource(connectionId: string, uri: string) {
    const client = this.getClient(connectionId);
    return client.readResource({ uri });
  }

  async listPrompts(connectionId?: string) {
    const targets = connectionId
      ? [this.getLiveOrThrow(connectionId)]
      : [...this.live.values()];
    const prompts = [];
    for (const conn of targets) {
      try {
        const result = await conn.client.listPrompts();
        for (const prompt of result.prompts) {
          prompts.push({
            connectionId: conn.id,
            connectionName: conn.name,
            name: prompt.name,
            description: prompt.description ?? '',
            arguments: prompt.arguments ?? [],
          });
        }
      } catch {
        // Server may not implement prompts.
      }
    }
    return prompts;
  }

  async getPrompt(
    connectionId: string,
    name: string,
    args?: Record<string, string>,
  ) {
    const client = this.getClient(connectionId);
    return client.getPrompt({ name, arguments: args });
  }

  search(query: string) {
    const q = query.trim().toLowerCase();
    return {
      connections: this.listLive().filter((c) => c.name.toLowerCase().includes(q)),
    };
  }

  private getLiveOrThrow(id: string) {
    const live = this.live.get(id);
    if (!live) throw new Error(`MCP connection not found or not connected: ${id}`);
    return live;
  }
}

export const mcpManager = new McpManager();
