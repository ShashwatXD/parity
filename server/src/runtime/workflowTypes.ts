export type WorkflowStep =
  | {
      id: string;
      type: 'tool';
      connectionId: string;
      toolName: string;
      args?: Record<string, unknown>;
      requireApproval?: boolean;
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
