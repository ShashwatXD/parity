import { mcpManager } from '../mcp/manager.js';
import { ApprovalRepository } from '../repositories/approvalRepository.js';
import { ArtifactRepository } from '../repositories/artifactRepository.js';
import { ExecutionRepository } from '../repositories/executionRepository.js';
import { WorkflowRepository } from '../repositories/workflowRepository.js';
import type { WorkflowGraph } from './workflowTypes.js';

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

export async function runWorkflow(workflowId: string, input: Record<string, unknown> = {}) {
  const workflow = WorkflowRepository.getById(workflowId);
  if (!workflow) throw new Error('Workflow not found');
  const graph = JSON.parse(workflow.graphJson) as WorkflowGraph;
  const runId = WorkflowRepository.createRun(workflowId, JSON.stringify(input));
  const timeline = ExecutionRepository.startRun();

  ExecutionRepository.recordEvent({
    runId: timeline.runId,
    kind: 'workflow_start',
    label: `Workflow ${workflow.name}`,
    detail: { workflowId, runId, input },
  });

  const stepOutputs: Record<string, unknown> = { input };
  try {
    for (const step of graph.steps) {
      const started = Date.now();
      if (step.type === 'tool') {
        if (step.requireApproval) {
          const approvalId = ApprovalRepository.createPending({
            runId,
            toolName: `${step.connectionId}:${step.toolName}`,
            args: step.args ?? {},
          });
          await waitForApproval(approvalId);
        }
        const args = {
          ...(step.args ?? {}),
          ...((input.toolArgs as Record<string, unknown>) ?? {}),
        };
        const result = await mcpManager.callTool(step.connectionId, step.toolName, args);
        stepOutputs[step.id] = result;
        ExecutionRepository.recordEvent({
          runId: timeline.runId,
          kind: 'tool_call',
          label: step.toolName,
          detail: { connectionId: step.connectionId, args, result },
          latencyMs: Date.now() - started,
        });
      } else if (step.type === 'artifact') {
        const source = step.fromStepId ? stepOutputs[step.fromStepId] : stepOutputs;
        const content =
          typeof source === 'string' ? source : JSON.stringify(source, null, 2);
        const artifact = ArtifactRepository.create({
          runId,
          title: step.title,
          kind: step.kind ?? 'markdown',
          content:
            step.kind === 'markdown'
              ? `# ${step.title}\n\n\`\`\`json\n${content}\n\`\`\`\n`
              : content,
        });
        stepOutputs[step.id] = artifact;
        ExecutionRepository.recordEvent({
          runId: timeline.runId,
          kind: 'artifact',
          label: step.title,
          detail: { artifactId: artifact.id },
          latencyMs: Date.now() - started,
        });
      }
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
