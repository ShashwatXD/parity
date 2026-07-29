import { jsonSchema, stepCountIs, streamText, tool, type ModelMessage, type ToolSet } from 'ai';
import { getModel, type ProviderId } from '../llm/providers.js';
import { mcpManager } from '../mcp/manager.js';
import { estimateCostUsd } from '../observability/cost.js';
import { recordEvent, startRun } from '../observability/timeline.js';
import { createArtifact } from './artifacts.js';
import { addMessage, listMessages } from './sessions.js';

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
          const preview =
            typeof result === 'string' ? result.slice(0, 2000) : JSON.stringify(result).slice(0, 2000);
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
  provider: ProviderId;
  model: string;
}) {
  const { runId } = startRun(input.sessionId);
  recordEvent({
    runId,
    sessionId: input.sessionId,
    kind: 'user_prompt',
    label: 'User Prompt',
    detail: { message: input.userMessage, provider: input.provider, model: input.model },
  });

  addMessage({
    sessionId: input.sessionId,
    role: 'user',
    content: input.userMessage,
  });

  const history = listMessages(input.sessionId);
  const modelMessages: ModelMessage[] = history
    .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'system')
    .map((m) => ({
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
    model: getModel(input.provider, input.model),
    system:
      'You are Parity MCP Studio. Use connected MCP tools when they help answer the user. Be concise and precise. When useful, structure final answers as clear markdown.',
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(8),
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
        provider: input.provider,
        model: input.model,
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
