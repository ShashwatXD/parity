/**
 * Forward-looking agent / workspace models (OpenHands-style).
 * UI and API will grow into these; keep DTOs stable early.
 */

export type AgentExecutionStatus =
  | 'idle'
  | 'running'
  | 'waiting_for_confirmation'
  | 'paused'
  | 'finished'
  | 'error';

export type AgentEventKind =
  | 'message'
  | 'action'
  | 'observation'
  | 'system'
  | 'condensation'
  | 'state';

export type AgentEvent = {
  id: string;
  kind: AgentEventKind;
  label: string;
  detail?: unknown;
  toolName?: string;
  toolCallId?: string;
  securityRisk?: 'low' | 'medium' | 'high';
  createdAt: number;
};

export type WorkspaceMount = {
  id: string;
  label: string;
  rootPath: string;
  backend: 'local' | 'docker' | 'remote';
};

export type WorkspaceFileNode = {
  path: string;
  name: string;
  kind: 'file' | 'dir';
  children?: WorkspaceFileNode[];
};
