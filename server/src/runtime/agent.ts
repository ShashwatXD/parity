import { jsonSchema, stepCountIs, streamText, tool, type ModelMessage, type ToolSet } from 'ai';
import { z } from 'zod';
import { getModelForProfile } from '../llm/providers.js';
import { mcpManager } from '../mcp/manager.js';
import { estimateCostUsd } from '../observability/cost.js';
import { recordEvent, startRun } from '../observability/timeline.js';
import { getWorkspaceRoot } from '../workspace/paths.js';
import { formatSkillsForPrompt, selectSkillsForMessage } from '../agent/skills.js';
import { detectStuck, stepFromToolCall, type StuckStep } from '../agent/stuckDetector.js';
import { runSubagent } from '../agent/subagent.js';
import { formatPlanMarkdown } from '../agent/taskTracker.js';
import { buildWorkspaceTools } from '../agent/workspaceTools.js';
import { createArtifact } from './artifacts.js';
import {
  buildContextSnapshot,
  maybeCondenseSession,
  messagesForModel,
} from './contextWindow.js';
import { getMaxAgentSteps, getSystemPrompt } from './settings.js';
import { addMessage } from './sessions.js';

function jsonSchemaFromMcp(inputSchema: unknown) {
  const schema =
    inputSchema && typeof inputSchema === 'object'
      ? (inputSchema as Record<string, unknown>)
      : { type: 'object', properties: {} };
  return jsonSchema<Record<string, unknown>>(schema);
}

async function buildMcpTools(runId: string, sessionId: string): Promise<ToolSet> {
  const discovered = await mcpManager.listTools();
  const tools: ToolSet = {};

  for (const item of discovered) {
    const key = `${item.connectionName}__${item.name}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    tools[key] = tool({
      description: `[${item.connectionName}] ${item.description || item.name}`,
      inputSchema: jsonSchemaFromMcp(item.inputSchema),
      execute: async (args: Record<string, unknown>) => {
        const started = Date.now();
        try {
          const result = await mcpManager.callTool(item.connectionId, item.name, args);
          const latencyMs = Date.now() - started;
          const raw = typeof result === 'string' ? result : JSON.stringify(result ?? null);
          const preview = raw.slice(0, 2000);
          addMessage({
            sessionId,
            role: 'tool',
            content: preview,
            toolName: `${item.connectionName}.${item.name}`,
            latencyMs,
          });
          recordEvent({
            runId,
            sessionId,
            kind: 'tool_call',
            label: `${item.connectionName}.${item.name}`,
            detail: { args, result },
            latencyMs,
          });
          return result;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          addMessage({
            sessionId,
            role: 'tool',
            content: `ERROR: ${message}`,
            toolName: `${item.connectionName}.${item.name}`,
            latencyMs: Date.now() - started,
          });
          recordEvent({
            runId,
            sessionId,
            kind: 'tool_error',
            label: `${item.connectionName}.${item.name}`,
            detail: { args, message },
            status: 'error',
            latencyMs: Date.now() - started,
          });
          throw error;
        }
      },
    });
  }

  return tools;
}

function wrapToolsForTelemetry(
  tools: ToolSet,
  runId: string,
  sessionId: string,
  stuckSteps: StuckStep[],
): ToolSet {
  const wrapped: ToolSet = {};
  for (const [name, def] of Object.entries(tools)) {
    const original = def as {
      description?: string;
      inputSchema?: unknown;
      execute?: (args: unknown, opts: unknown) => Promise<unknown>;
    };
    wrapped[name] = tool({
      description: original.description ?? name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: original.inputSchema as any,
      execute: async (args: unknown, opts: unknown) => {
        const started = Date.now();
        try {
          const result = original.execute
            ? await original.execute(args, opts)
            : undefined;
          const raw = typeof result === 'string' ? result : JSON.stringify(result ?? null);
          const isError = typeof raw === 'string' && raw.startsWith('ERROR:');
          stuckSteps.push(
            stepFromToolCall({
              toolName: name,
              args,
              result: raw.slice(0, 500),
              isError,
            }),
          );
          addMessage({
            sessionId,
            role: 'tool',
            content: raw.slice(0, 2000),
            toolName: name,
            latencyMs: Date.now() - started,
          });
          recordEvent({
            runId,
            sessionId,
            kind: isError ? 'tool_error' : 'tool_call',
            label: name,
            detail: { args, preview: raw.slice(0, 500) },
            status: isError ? 'error' : 'ok',
            latencyMs: Date.now() - started,
          });
          return result;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          stuckSteps.push(
            stepFromToolCall({
              toolName: name,
              args,
              result: message,
              isError: true,
            }),
          );
          addMessage({
            sessionId,
            role: 'tool',
            content: `ERROR: ${message}`,
            toolName: name,
            latencyMs: Date.now() - started,
          });
          recordEvent({
            runId,
            sessionId,
            kind: 'tool_error',
            label: name,
            detail: { args, message },
            status: 'error',
            latencyMs: Date.now() - started,
          });
          throw error;
        }
      },
    });
  }
  return wrapped;
}

function buildAgentSystemPrompt(input: {
  userMessage: string;
  sessionId: string;
  mcpTools: Array<{ connectionName: string; name: string }>;
}): string {
  const skills = selectSkillsForMessage(input.userMessage);
  const skillBlock = formatSkillsForPrompt(skills);
  const plan = formatPlanMarkdown(input.sessionId);
  const base = getSystemPrompt();
  const mcpLines =
    input.mcpTools.length === 0
      ? ['(none connected — if the task needs an MCP server, ask the user to connect it in Servers before guessing)']
      : input.mcpTools.map((t) => `- ${t.connectionName}.${t.name}`);

  return [
    base,
    '',
    '## Workspace sandbox',
    `Root: ${getWorkspaceRoot()}`,
    'Native tools: file_editor, terminal, glob, grep, list_dir, git_status, task_tracker, delegate_task.',
    'For multi-step coding work: create a task_tracker plan first, then execute.',
    '',
    '## Connected MCP tools',
    ...mcpLines,
    'Use only tools listed above (plus native workspace tools). MCP tool names are not shell commands — never run them via `terminal`.',
    'If the user asks for a capability that needs an MCP you do not have (e.g. browser tabs without Playwright tools), tell them which server to connect in Servers and stop — do not improvise with workspace tools.',
    '',
    '## Current plan',
    plan,
    skillBlock ? `\n${skillBlock}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function runAgentTurn(input: {
  sessionId: string;
  userMessage: string;
  profileId?: string;
}) {
  const active = getModelForProfile(input.profileId);
  const provider = active.provider;
  const modelId = active.modelId;

  const { runId } = startRun(input.sessionId);
  recordEvent({
    runId,
    sessionId: input.sessionId,
    kind: 'user_prompt',
    label: 'User Prompt',
    detail: {
      message: input.userMessage,
      provider,
      model: modelId,
      profileId: active.profile?.id,
      profileName: active.profile?.name,
      workspace: getWorkspaceRoot(),
    },
  });

  addMessage({
    sessionId: input.sessionId,
    role: 'user',
    content: input.userMessage,
  });

  const before = buildContextSnapshot({
    sessionId: input.sessionId,
    provider,
    model: modelId,
  });
  recordEvent({
    runId,
    sessionId: input.sessionId,
    kind: 'context',
    label: 'Context window',
    detail: before,
  });

  const condensation = await maybeCondenseSession({
    sessionId: input.sessionId,
    provider,
    model: modelId,
    profileId: active.profile?.id,
    runId,
  });
  if (condensation.condensed) {
    recordEvent({
      runId,
      sessionId: input.sessionId,
      kind: 'condensation',
      label: 'Conversation summarized',
      detail: {
        beforeTokens: before.usedTokens,
        afterTokens: condensation.snapshot.usedTokens,
        preview: condensation.summary?.slice(0, 280),
      },
    });
  }

  const history = messagesForModel(input.sessionId);
  const modelMessages: ModelMessage[] = history.map((m) => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content,
  }));

  const skills = selectSkillsForMessage(input.userMessage);
  const discoveredTools = await mcpManager.listTools();
  recordEvent({
    runId,
    sessionId: input.sessionId,
    kind: 'planner',
    label: 'Tool inventory',
    detail: {
      toolCount: discoveredTools.length,
      tools: discoveredTools.map((t) => `${t.connectionName}.${t.name}`),
      workspaceTools: [
        'file_editor',
        'terminal',
        'glob',
        'grep',
        'list_dir',
        'git_status',
        'task_tracker',
        'delegate_task',
      ],
      skills: skills.map((s) => s.name),
      workspace: getWorkspaceRoot(),
    },
  });

  const stuckSteps: StuckStep[] = [];
  let stuckWarned = false;

  const workspaceTools = buildWorkspaceTools(input.sessionId);
  const mcpTools = await buildMcpTools(runId, input.sessionId);

  const delegate = tool({
    description:
      'Delegate a focused coding subtask to a nested subagent with workspace tools only. Use for parallelizable or isolated work.',
    inputSchema: z.object({
      goal: z.string().describe('Clear, self-contained goal for the subagent'),
      max_steps: z.number().int().min(1).max(12).optional(),
    }),
    execute: async (args) => {
      const started = Date.now();
      try {
        const result = await runSubagent({
          sessionId: input.sessionId,
          goal: args.goal,
          profileId: active.profile?.id,
          maxSteps: args.max_steps,
        });
        recordEvent({
          runId,
          sessionId: input.sessionId,
          kind: 'subagent',
          label: 'Subagent completed',
          detail: { goal: args.goal, steps: result.steps, preview: result.text.slice(0, 400) },
          latencyMs: Date.now() - started,
        });
        return JSON.stringify(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        recordEvent({
          runId,
          sessionId: input.sessionId,
          kind: 'subagent',
          label: 'Subagent failed',
          detail: { goal: args.goal, message },
          status: 'error',
          latencyMs: Date.now() - started,
        });
        return `ERROR: ${message}`;
      }
    },
  });

  // MCP tools already log themselves; wrap workspace + delegate for stuck + telemetry
  const tools: ToolSet = {
    ...wrapToolsForTelemetry({ ...workspaceTools, delegate_task: delegate }, runId, input.sessionId, stuckSteps),
    ...mcpTools,
  };

  const started = Date.now();
  let stepIndex = 0;
  const system = buildAgentSystemPrompt({
    userMessage: input.userMessage,
    sessionId: input.sessionId,
    mcpTools: discoveredTools.map((t) => ({
      connectionName: t.connectionName,
      name: t.name,
    })),
  });

  const result = streamText({
    model: active.model,
    system,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(getMaxAgentSteps()),
    maxRetries: 2,
    prepareStep: async ({ messages }) => {
      const verdict = detectStuck(stuckSteps);
      if (verdict.stuck && !stuckWarned) {
        stuckWarned = true;
        recordEvent({
          runId,
          sessionId: input.sessionId,
          kind: 'stuck',
          label: 'Stuck detected',
          detail: { reason: verdict.reason, message: verdict.message },
          status: 'error',
        });
        return {
          messages: [
            ...messages,
            {
              role: 'user' as const,
              content: `[SYSTEM — STUCK DETECTOR]\n${verdict.message}`,
            },
          ],
        };
      }
      return {};
    },
    onStepFinish: async ({ toolCalls, toolResults, finishReason, usage }) => {
      stepIndex += 1;
      recordEvent({
        runId,
        sessionId: input.sessionId,
        kind: 'react_step',
        label: `ReAct step ${stepIndex}`,
        detail: {
          finishReason,
          toolCalls: toolCalls?.map((c) => c.toolName) ?? [],
          toolResultCount: toolResults?.length ?? 0,
          tokensPrompt: usage?.inputTokens ?? 0,
          tokensCompletion: usage?.outputTokens ?? 0,
          stuck: detectStuck(stuckSteps),
        },
        tokensPrompt: usage?.inputTokens ?? 0,
        tokensCompletion: usage?.outputTokens ?? 0,
      });
    },
    onFinish: async ({ text, usage }) => {
      const latencyMs = Date.now() - started;
      const promptTokens = usage?.inputTokens ?? 0;
      const completionTokens = usage?.outputTokens ?? 0;
      const costUsd = estimateCostUsd({
        provider,
        model: modelId,
        promptTokens,
        completionTokens,
      });
      addMessage({
        sessionId: input.sessionId,
        role: 'assistant',
        content: text,
        tokensPrompt: promptTokens,
        tokensCompletion: completionTokens,
        latencyMs,
        costUsd,
      });
      recordEvent({
        runId,
        sessionId: input.sessionId,
        kind: 'assistant_response',
        label: 'Completed',
        detail: { preview: text.slice(0, 280), costUsd },
        latencyMs,
        tokensPrompt: promptTokens,
        tokensCompletion: completionTokens,
        costUsd,
      });
      if (text.trim().length > 40) {
        createArtifact({
          sessionId: input.sessionId,
          runId,
          title: `Chat summary ${new Date().toISOString()}`,
          kind: 'markdown',
          content: text,
        });
      }
    },
  });

  return { result, runId };
}
