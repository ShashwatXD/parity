import { generateText, jsonSchema, stepCountIs, tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { mcpManager } from '../mcp/manager.js';
import { AgentRepository } from '../repositories/agentRepository.js';
import { getModelForProfile } from '../llm/providers.js';
import { buildWorkspaceTools } from './workspaceTools.js';
import type { AgentDef, AgentToolAccess } from '../runtime/teamTypes.js';

function jsonSchemaFromMcp(inputSchema: unknown) {
  const schema =
    inputSchema && typeof inputSchema === 'object'
      ? (inputSchema as Record<string, unknown>)
      : { type: 'object', properties: {} };
  return jsonSchema<Record<string, unknown>>(schema);
}

async function buildMcpToolSet(): Promise<ToolSet> {
  const discovered = await mcpManager.listTools();
  const tools: ToolSet = {};
  for (const item of discovered) {
    const key = `${item.connectionName}__${item.name}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    tools[key] = tool({
      description: `[${item.connectionName}] ${item.description || item.name}`,
      inputSchema: jsonSchemaFromMcp(item.inputSchema),
      execute: async (args: Record<string, unknown>) => {
        const result = await mcpManager.callTool(item.connectionId, item.name, args);
        return typeof result === 'string' ? result : JSON.stringify(result ?? null);
      },
    });
  }
  return tools;
}

export async function buildToolsForAccess(
  sessionId: string,
  access: AgentToolAccess,
  opts?: { allowDelegate?: boolean },
): Promise<ToolSet> {
  const tools: ToolSet = {};
  if (access === 'workspace' || access === 'all') {
    Object.assign(tools, buildWorkspaceTools(sessionId));
  }
  if (access === 'mcp' || access === 'all') {
    Object.assign(tools, await buildMcpToolSet());
  }
  if (!opts?.allowDelegate) {
    delete (tools as Record<string, unknown>).delegate_task;
    delete (tools as Record<string, unknown>).run_team;
  }
  return tools;
}

export function resolveAgentDef(agentIdOrName?: string): AgentDef | undefined {
  if (!agentIdOrName) return undefined;
  return AgentRepository.getById(agentIdOrName) ?? AgentRepository.getByName(agentIdOrName);
}

/**
 * Nested agent turn for focused subtasks / team workers.
 */
export async function runSubagent(input: {
  sessionId: string;
  goal: string;
  profileId?: string;
  maxSteps?: number;
  agentId?: string;
  systemPrompt?: string;
  tools?: AgentToolAccess;
  /** Extra context prepended to the goal (shared team state, prior outputs). */
  context?: string;
}): Promise<{ text: string; steps: number; agentName?: string }> {
  const agent = input.agentId ? resolveAgentDef(input.agentId) : undefined;
  const access = input.tools ?? agent?.tools ?? 'workspace';
  const profileId = agent?.profileId || input.profileId;
  const active = getModelForProfile(profileId);
  const tools = await buildToolsForAccess(`${input.sessionId}:sub`, access, {
    allowDelegate: false,
  });

  const system = [
    agent?.systemPrompt ||
      input.systemPrompt ||
      'You are a focused Parity subagent. Complete ONLY the assigned goal.',
    access === 'none'
      ? 'You have no tools — reason from the provided context only.'
      : access === 'mcp'
        ? 'Use MCP tools only.'
        : 'Use available tools. Be concise.',
    'Return a short final summary of what you did and any remaining risks.',
  ].join(' ');

  const prompt = [
    input.context ? `Context:\n${input.context}\n` : '',
    `Goal:\n${input.goal}`,
  ]
    .filter(Boolean)
    .join('\n');

  const maxSteps = Math.min(
    input.maxSteps ?? agent?.maxSteps ?? 8,
    16,
  );

  const result = await generateText({
    model: active.model,
    system,
    prompt,
    ...(Object.keys(tools).length ? { tools, stopWhen: stepCountIs(maxSteps) } : {}),
    maxRetries: 1,
  });

  return {
    text: result.text || '(subagent finished with no text)',
    steps: result.steps?.length ?? 0,
    agentName: agent?.name,
  };
}

/** Lightweight planner used by hierarchical teams when director has no tools. */
export async function planTeamOrders(input: {
  task: string;
  workers: Array<{ id: string; name: string; description: string }>;
  profileId?: string;
  directorSystemPrompt?: string;
}): Promise<{ plan: string; orders: Array<{ agentId: string; goal: string }> }> {
  if (!input.workers.length) {
    return { plan: 'No workers available', orders: [] };
  }

  const active = getModelForProfile(input.profileId);
  const workerList = input.workers
    .map((w) => `- ${w.name} (${w.id}): ${w.description}`)
    .join('\n');

  const result = await generateText({
    model: active.model,
    system:
      input.directorSystemPrompt ||
      'You are a team director. Output ONLY valid JSON with keys plan (string) and orders (array of {agentId, goal}). Assign each worker at most one clear goal. Prefer parallel independent goals.',
    prompt: `Task:\n${input.task}\n\nWorkers:\n${workerList}\n\nRespond with JSON only.`,
    maxRetries: 1,
  });

  const text = result.text || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    // Fallback: give every worker the full task
    return {
      plan: 'Fallback: each worker receives the full task',
      orders: input.workers.map((w) => ({ agentId: w.id, goal: input.task })),
    };
  }

  try {
    const parsed = JSON.parse(match[0]) as {
      plan?: string;
      orders?: Array<{ agentId?: string; agentName?: string; goal?: string }>;
    };
    const orders: Array<{ agentId: string; goal: string }> = [];
    for (const o of parsed.orders ?? []) {
      const byId = input.workers.find((w) => w.id === o.agentId);
      const byName = input.workers.find(
        (w) => w.name.toLowerCase() === String(o.agentName || o.agentId || '').toLowerCase(),
      );
      const worker = byId ?? byName;
      const goal = String(o.goal || '').trim();
      if (worker && goal) orders.push({ agentId: worker.id, goal });
    }
    if (!orders.length) {
      return {
        plan: parsed.plan || 'Fallback plan',
        orders: input.workers.map((w) => ({ agentId: w.id, goal: input.task })),
      };
    }
    return { plan: String(parsed.plan || 'Director plan'), orders };
  } catch {
    return {
      plan: 'Parse fallback',
      orders: input.workers.map((w) => ({ agentId: w.id, goal: input.task })),
    };
  }
}

/** Schema kept for API / tooling docs. */
export const delegateSchema = z.object({
  goal: z.string(),
  max_steps: z.number().int().min(1).max(16).optional(),
  agent_id: z.string().optional(),
});
