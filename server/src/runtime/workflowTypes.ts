export type WorkflowWhen = { fromStepId: string; path?: string; equals?: unknown };

/** Leaf / composite steps for Parity workflows + multi-agent teams. */
export type WorkflowStep =
  | {
      id: string;
      type: 'tool';
      connectionId: string;
      toolName: string;
      args?: Record<string, unknown>;
      requireApproval?: boolean;
      /** Retry failed MCP tool calls (default 0). */
      maxRetries?: number;
      /** Skip step unless prior step output equals the expected value. */
      when?: WorkflowWhen;
    }
  | {
      id: string;
      type: 'artifact';
      title: string;
      kind?: 'markdown' | 'json' | 'text';
      fromStepId?: string;
      when?: WorkflowWhen;
    }
  | {
      id: string;
      type: 'agent';
      /** Agent def id or name */
      agentId: string;
      prompt?: string;
      promptFromStepId?: string;
      maxSteps?: number;
      when?: WorkflowWhen;
    }
  | {
      id: string;
      type: 'parallel';
      /** Child steps run concurrently; results keyed by child id under this step. */
      steps: WorkflowStep[];
      when?: WorkflowWhen;
    }
  | {
      id: string;
      type: 'synthesize';
      /** Optional synthesizer agent (defaults to "synthesizer"). */
      agentId?: string;
      fromStepIds: string[];
      prompt?: string;
      when?: WorkflowWhen;
    }
  | {
      id: string;
      type: 'handoff';
      fromStepId: string;
      toAgentId: string;
      prompt?: string;
      when?: WorkflowWhen;
    }
  | {
      id: string;
      type: 'team';
      task?: string;
      taskFromStepId?: string;
      directorAgentId?: string;
      workerAgentIds?: string[];
      maxLoops?: number;
      parallel?: boolean;
      when?: WorkflowWhen;
    };

export type WorkflowGraph = {
  steps: WorkflowStep[];
};
