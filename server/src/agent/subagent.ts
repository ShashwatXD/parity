import { generateText, stepCountIs, type ToolSet } from 'ai';
import { getModelForProfile } from '../llm/providers.js';
import { buildWorkspaceTools } from './workspaceTools.js';

/**
 * Nested agent turn for focused subtasks. Workspace tools only (no MCP, no recurse).
 */
export async function runSubagent(input: {
  sessionId: string;
  goal: string;
  profileId?: string;
  maxSteps?: number;
}): Promise<{ text: string; steps: number }> {
  const active = getModelForProfile(input.profileId);
  const tools = buildWorkspaceTools(`${input.sessionId}:sub`) as ToolSet;
  // Prevent recursive delegation inside the subagent
  delete (tools as Record<string, unknown>).delegate_task;

  const result = await generateText({
    model: active.model,
    system: [
      'You are a focused Parity subagent. Complete ONLY the assigned goal.',
      'Use workspace tools (files, terminal, grep, git). Be concise.',
      'Return a short final summary of what you did and any remaining risks.',
    ].join(' '),
    prompt: input.goal,
    tools,
    stopWhen: stepCountIs(Math.min(input.maxSteps ?? 8, 12)),
    maxRetries: 1,
  });

  return {
    text: result.text || '(subagent finished with no text)',
    steps: result.steps?.length ?? 0,
  };
}
