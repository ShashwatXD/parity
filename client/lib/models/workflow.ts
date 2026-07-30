export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | string;

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | string;

export type ArtifactKind = 'markdown' | 'json' | 'text' | 'report' | string;

export type Workflow = {
  id: string;
  name: string;
  description?: string;
  graphJson?: string;
  createdAt?: number;
  updatedAt?: number;
};

export type WorkflowGraph = {
  steps: Array<Record<string, unknown>>;
};

export type CreateWorkflowInput = {
  name: string;
  description?: string;
  graph?: WorkflowGraph;
  graphJson?: string;
};

export type WorkflowRunInput = {
  input?: Record<string, unknown>;
  background?: boolean;
};

export type WorkflowRunResult = {
  timelineRunId?: string;
  [key: string]: unknown;
};

export type Approval = {
  id: string;
  toolName: string;
  status: ApprovalStatus;
  runId?: string;
  argsJson?: string;
};

export type Artifact = {
  id: string;
  title: string;
  kind: ArtifactKind;
  content?: string;
  runId?: string | null;
  sessionId?: string | null;
};

export type BackgroundJob = {
  id?: string;
  kind?: string;
  status?: JobStatus;
  [key: string]: unknown;
};

export type PluginInfo = {
  name: string;
  version: string;
};
