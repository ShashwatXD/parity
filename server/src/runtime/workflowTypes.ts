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
      when?: { fromStepId: string; path?: string; equals?: unknown };
    }
  | {
      id: string;
      type: 'artifact';
      title: string;
      kind?: 'markdown' | 'json' | 'text';
      fromStepId?: string;
    };

export type WorkflowGraph = {
  steps: WorkflowStep[];
};
