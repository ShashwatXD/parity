import type { McpTransport } from '../models';

export const DEFAULT_MCP = {
  name: 'filesystem',
  transport: 'stdio' as const satisfies McpTransport,
  command: 'npx',
  args: '-y @modelcontextprotocol/server-filesystem /tmp',
  url: 'http://127.0.0.1:3001/mcp',
};

export type PublicMcpPreset =
  | {
      id: string;
      name: string;
      description: string;
      transport: 'stdio';
      command: string;
      args: string[];
      requiresGithubToken?: boolean;
    }
  | {
      id: string;
      name: string;
      description: string;
      transport: 'http';
      url: string;
      requiresGithubToken?: boolean;
    };

/** Official / well-known MCP servers. GitHub presets need a PAT. */
export const PUBLIC_MCP_SERVERS: PublicMcpPreset[] = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: 'Read/write files under /tmp (official reference server).',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
  },
  {
    id: 'memory',
    name: 'Memory',
    description: 'Knowledge-graph memory across turns (official).',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
  },
  {
    id: 'sequential-thinking',
    name: 'Sequential Thinking',
    description: 'Structured multi-step reasoning tools (official).',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
  },
  {
    id: 'everything',
    name: 'Everything',
    description: 'Demo server with sample tools, resources, and prompts.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-everything'],
  },
  {
    id: 'playwright',
    name: 'Playwright',
    description: 'Browser automation via Microsoft Playwright MCP.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@playwright/mcp'],
  },
  {
    id: 'context7',
    name: 'Context7',
    description: 'Up-to-date library docs for coding agents (Upstash).',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@upstash/context7-mcp'],
  },
  {
    id: 'github-docker',
    name: 'GitHub (Docker)',
    description:
      'Official GitHub MCP via Docker (repos, issues, PRs). Needs Docker + a GitHub PAT.',
    transport: 'stdio',
    command: 'docker',
    args: [
      'run',
      '-i',
      '--rm',
      '-e',
      'GITHUB_PERSONAL_ACCESS_TOKEN',
      'ghcr.io/github/github-mcp-server',
    ],
    requiresGithubToken: true,
  },
  {
    id: 'github-remote',
    name: 'GitHub (Remote)',
    description:
      'Hosted GitHub MCP at api.githubcopilot.com — no Docker. Needs a GitHub PAT.',
    transport: 'http',
    url: 'https://api.githubcopilot.com/mcp/',
    requiresGithubToken: true,
  },
];
