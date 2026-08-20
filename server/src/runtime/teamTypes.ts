import { z } from 'zod';

/** Which tools a team agent may use. */
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

export const agentDefInputSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional().default(''),
  systemPrompt: z.string().min(1).max(8000),
  profileId: z.string().nullable().optional(),
  tools: z.enum(['none', 'workspace', 'mcp', 'all']).optional().default('workspace'),
  maxSteps: z.number().int().min(1).max(24).optional().default(8),
});

export type AgentDefInput = z.infer<typeof agentDefInputSchema>;

export type TeamMessage = {
  from: string;
  to: string;
  content: string;
  at: number;
};

export type TeamStatus = 'running' | 'waiting_approval' | 'completed' | 'failed';

/** Shared blackboard for a multi-agent team run. */
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

export type TeamOrder = {
  agentId: string;
  goal: string;
};

export type TeamSpec = {
  plan: string;
  orders: TeamOrder[];
};

export type WorkerResult = {
  agentId: string;
  agentName: string;
  goal: string;
  text: string;
  steps: number;
  ok: boolean;
  error?: string;
};

export type HierarchicalTeamInput = {
  task: string;
  sessionId?: string;
  directorAgentId?: string;
  workerAgentIds?: string[];
  maxLoops?: number;
  parallel?: boolean;
  profileId?: string;
  runId?: string;
};

export type HierarchicalTeamResult = {
  teamId: string;
  status: TeamStatus;
  plan: string;
  results: WorkerResult[];
  synthesis: string;
  state: TeamState;
};
