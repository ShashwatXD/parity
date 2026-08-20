export type AgentToolAccess = 'none' | 'workspace' | 'mcp' | 'all';

export type AgentDef = {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  profileId: string | null;
  tools: AgentToolAccess;
  maxSteps: number;
  createdAt: number;
  updatedAt: number;
};

export type AgentDefInput = {
  name: string;
  description?: string;
  systemPrompt: string;
  profileId?: string | null;
  tools?: AgentToolAccess;
  maxSteps?: number;
};

export type TeamMessage = {
  from: string;
  to: string;
  content: string;
  at: number;
};

export type TeamStatus = 'running' | 'waiting_approval' | 'completed' | 'failed' | string;

export type TeamState = {
  id: string;
  task: string;
  status: TeamStatus;
  artifacts: Record<string, unknown>;
  messages: TeamMessage[];
  directorPlan?: string;
  loop: number;
  maxLoops: number;
  sessionId?: string;
  createdAt: number;
  updatedAt: number;
};

export type TeamRunInput = {
  task: string;
  sessionId?: string;
  directorAgentId?: string;
  workerAgentIds?: string[];
  maxLoops?: number;
  parallel?: boolean;
  profileId?: string;
};

export type TeamWorkerResult = {
  agentId: string;
  agentName: string;
  goal: string;
  text: string;
  steps: number;
  ok: boolean;
  error?: string;
};

export type TeamRunResult = {
  teamId: string;
  status: TeamStatus;
  plan: string;
  results: TeamWorkerResult[];
  synthesis: string;
  state: TeamState;
};
