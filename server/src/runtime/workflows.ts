import { mcpManager } from '../mcp/manager.js';
import { ApprovalRepository } from '../repositories/approvalRepository.js';
import { ArtifactRepository } from '../repositories/artifactRepository.js';
import { ExecutionRepository } from '../repositories/executionRepository.js';
import { WorkflowRepository } from '../repositories/workflowRepository.js';
import { runSubagent } from '../agent/subagent.js';
import { runHierarchicalTeam } from './team.js';
import type { WorkflowGraph, WorkflowStep, WorkflowWhen } from './workflowTypes.js';

export type { WorkflowStep, WorkflowGraph } from './workflowTypes.js';

export function createWorkflow(input: {
  name: string;
  description?: string;
  graph: WorkflowGraph;
}) {
  return WorkflowRepository.create({
    name: input.name,
    description: input.description,
    graphJson: JSON.stringify(input.graph),
  });
}

export function listWorkflows() {
  return WorkflowRepository.list();
}

export function getWorkflow(id: string) {
  return WorkflowRepository.getById(id);
}

function readPath(value: unknown, path?: string): unknown {
  if (!path) return value;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, value);
}

function shouldRunStep(when: WorkflowWhen | undefined, stepOutputs: Record<string, unknown>): boolean {
  if (!when) return true;
  const source = stepOutputs[when.fromStepId];
  const actual = readPath(source, when.path);
  return JSON.stringify(actual) === JSON.stringify(when.equals);
}

function resolvePrompt(
  step: { prompt?: string; promptFromStepId?: string },
  stepOutputs: Record<string, unknown>,
  fallback = '',
): string {
  if (step.promptFromStepId) {
    const src = stepOutputs[step.promptFromStepId];
    const text = typeof src === 'string' ? src : JSON.stringify(src ?? '', null, 2);
    return step.prompt ? `${step.prompt}\n\n${text}` : text;
  }
  return step.prompt ?? fallback;
}

async function callToolWithRetry(
  connectionId: string,
  toolName: string,
  args: Record<string, unknown>,
  maxRetries: number,
) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await mcpManager.callTool(connectionId, toolName, args);
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

type RunCtx = {
  runId: string;
  timelineRunId: string;
  input: Record<string, unknown>;
  sessionId?: string;
};

async function executeStep(
  step: WorkflowStep,
  stepOutputs: Record<string, unknown>,
  ctx: RunCtx,
): Promise<unknown> {
  const started = Date.now();
  const when = 'when' in step ? step.when : undefined;
  if (!shouldRunStep(when, stepOutputs)) {
    ExecutionRepository.recordEvent({
      runId: ctx.timelineRunId,
      kind: 'workflow_skip',
      label: step.id,
      detail: { reason: 'when condition not met' },
      latencyMs: Date.now() - started,
    });
    return { skipped: true };
  }

  if (step.type === 'tool') {
    if (step.requireApproval) {
      const approvalId = ApprovalRepository.createPending({
        runId: ctx.runId,
        toolName: `${step.connectionId}:${step.toolName}`,
        args: step.args ?? {},
      });
      await waitForApproval(approvalId);
    }
    const args = {
      ...(step.args ?? {}),
      ...((ctx.input.toolArgs as Record<string, unknown>) ?? {}),
    };
    const result = await callToolWithRetry(
      step.connectionId,
      step.toolName,
      args,
      step.maxRetries ?? 0,
    );
    ExecutionRepository.recordEvent({
      runId: ctx.timelineRunId,
      kind: 'tool_call',
      label: step.toolName,
      detail: { connectionId: step.connectionId, args, result, maxRetries: step.maxRetries ?? 0 },
      latencyMs: Date.now() - started,
    });
    return result;
  }

  if (step.type === 'artifact') {
    const source = step.fromStepId ? stepOutputs[step.fromStepId] : stepOutputs;
    const content = typeof source === 'string' ? source : JSON.stringify(source, null, 2);
    const artifact = ArtifactRepository.create({
      runId: ctx.runId,
      title: step.title,
      kind: step.kind ?? 'markdown',
      content:
        step.kind === 'markdown'
          ? `# ${step.title}\n\n\`\`\`json\n${content}\n\`\`\`\n`
          : content,
    });
    ExecutionRepository.recordEvent({
      runId: ctx.timelineRunId,
      kind: 'artifact',
      label: step.title,
      detail: { artifactId: artifact.id },
      latencyMs: Date.now() - started,
    });
    return artifact;
  }

  if (step.type === 'agent') {
    const prompt = resolvePrompt(step, stepOutputs, String(ctx.input.task ?? ctx.input.prompt ?? ''));
    const result = await runSubagent({
      sessionId: ctx.sessionId ?? ctx.runId,
      goal: prompt || 'Complete the assigned agent step.',
      agentId: step.agentId,
      maxSteps: step.maxSteps,
    });
    ExecutionRepository.recordEvent({
      runId: ctx.timelineRunId,
      kind: 'agent_step',
      label: step.agentId,
      detail: { steps: result.steps, preview: result.text.slice(0, 400) },
      latencyMs: Date.now() - started,
    });
    return result;
  }

  if (step.type === 'parallel') {
    const entries = await Promise.all(
      step.steps.map(async (child) => {
        const value = await executeStep(child, stepOutputs, ctx);
        return [child.id, value] as const;
      }),
    );
    const result = Object.fromEntries(entries);
    ExecutionRepository.recordEvent({
      runId: ctx.timelineRunId,
      kind: 'parallel',
      label: step.id,
      detail: { childIds: step.steps.map((s) => s.id) },
      latencyMs: Date.now() - started,
    });
    return result;
  }

  if (step.type === 'synthesize') {
    const parts = step.fromStepIds.map((id) => ({
      id,
      output: stepOutputs[id],
    }));
    const prompt = [
      step.prompt || 'Synthesize the following step outputs into one clear answer.',
      JSON.stringify(parts, null, 2),
    ].join('\n\n');
    const result = await runSubagent({
      sessionId: ctx.sessionId ?? ctx.runId,
      goal: prompt,
      agentId: step.agentId || 'synthesizer',
      tools: 'none',
      maxSteps: 4,
    });
    ExecutionRepository.recordEvent({
      runId: ctx.timelineRunId,
      kind: 'synthesize',
      label: step.id,
      detail: { fromStepIds: step.fromStepIds, preview: result.text.slice(0, 400) },
      latencyMs: Date.now() - started,
    });
    return result;
  }

  if (step.type === 'handoff') {
    const prior = stepOutputs[step.fromStepId];
    const prompt = [
      step.prompt || 'Continue from the previous agent output.',
      typeof prior === 'string' ? prior : JSON.stringify(prior, null, 2),
    ].join('\n\n');
    const result = await runSubagent({
      sessionId: ctx.sessionId ?? ctx.runId,
      goal: prompt,
      agentId: step.toAgentId,
    });
    ExecutionRepository.recordEvent({
      runId: ctx.timelineRunId,
      kind: 'handoff',
      label: `${step.fromStepId} → ${step.toAgentId}`,
      detail: { preview: result.text.slice(0, 400) },
      latencyMs: Date.now() - started,
    });
    return result;
  }

  if (step.type === 'team') {
    const task =
      (step.taskFromStepId
        ? typeof stepOutputs[step.taskFromStepId] === 'string'
          ? String(stepOutputs[step.taskFromStepId])
          : JSON.stringify(stepOutputs[step.taskFromStepId])
        : step.task) || String(ctx.input.task ?? '');
    if (!task.trim()) throw new Error(`Team step ${step.id} needs a task`);
    const result = await runHierarchicalTeam({
      task,
      sessionId: ctx.sessionId,
      directorAgentId: step.directorAgentId,
      workerAgentIds: step.workerAgentIds,
      maxLoops: step.maxLoops ?? 1,
      parallel: step.parallel !== false,
      runId: ctx.timelineRunId,
    });
    ExecutionRepository.recordEvent({
      runId: ctx.timelineRunId,
      kind: 'team',
      label: step.id,
      detail: { teamId: result.teamId, status: result.status },
      latencyMs: Date.now() - started,
    });
    return result;
  }

  throw new Error(`Unknown workflow step type`);
}

export async function runWorkflow(workflowId: string, input: Record<string, unknown> = {}) {
  const workflow = WorkflowRepository.getById(workflowId);
  if (!workflow) throw new Error('Workflow not found');
  const graph = JSON.parse(workflow.graphJson) as WorkflowGraph;
  const runId = WorkflowRepository.createRun(workflowId, JSON.stringify(input));
  const timeline = ExecutionRepository.startRun();
  const sessionId = typeof input.sessionId === 'string' ? input.sessionId : undefined;

  ExecutionRepository.recordEvent({
    runId: timeline.runId,
    kind: 'workflow_start',
    label: `Workflow ${workflow.name}`,
    detail: { workflowId, runId, input },
  });

  const stepOutputs: Record<string, unknown> = { input };
  const ctx: RunCtx = {
    runId,
    timelineRunId: timeline.runId,
    input,
    sessionId,
  };

  try {
    for (const step of graph.steps) {
      stepOutputs[step.id] = await executeStep(step, stepOutputs, ctx);
    }

    WorkflowRepository.completeRun(runId, JSON.stringify(stepOutputs));
    ExecutionRepository.recordEvent({
      runId: timeline.runId,
      kind: 'workflow_complete',
      label: 'Completed',
      detail: { runId },
    });
    return { runId, timelineRunId: timeline.runId, status: 'completed', output: stepOutputs };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    WorkflowRepository.failRun(runId, message);
    ExecutionRepository.recordEvent({
      runId: timeline.runId,
      kind: 'workflow_error',
      label: 'Failed',
      detail: { message },
      status: 'error',
    });
    throw error;
  }
}

async function waitForApproval(id: string, timeoutMs = 5 * 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const row = ApprovalRepository.getById(id);
    if (!row) throw new Error('Approval missing');
    if (row.status === 'approved') return;
    if (row.status === 'rejected') throw new Error(row.decisionNote || 'Tool call rejected');
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Approval timed out');
}

export function listApprovals(status?: string) {
  return ApprovalRepository.list(status);
}

export function resolveApproval(id: string, status: 'approved' | 'rejected', note?: string) {
  return ApprovalRepository.resolve(id, status, note);
}
