import { jsonSchema, stepCountIs, streamText, tool, type ModelMessage, type ToolSet } from 'ai';
import { getModelForProfile } from '../llm/providers.js';
import { mcpManager } from '../mcp/manager.js';
import { estimateCostUsd } from '../observability/cost.js';
import { recordEvent, startRun } from '../observability/timeline.js';
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

  const discoveredTools = await mcpManager.listTools();
  recordEvent({
    runId,
    sessionId: input.sessionId,
    kind: 'planner',
    label: 'Tool inventory',
    detail: {
      toolCount: discoveredTools.length,
      tools: discoveredTools.map((t) => `${t.connectionName}.${t.name}`),
    },
  });

  const tools = await buildMcpTools(runId, input.sessionId);
  const started = Date.now();
  let stepIndex = 0;

  const result = streamText({
    model: active.model,
    system: getSystemPrompt(),
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(getMaxAgentSteps()),
    maxRetries: 2,
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
