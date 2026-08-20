import { API_ROUTES } from '../../constants';
import type {
  AgentDef,
  AgentDefInput,
  TeamRunInput,
  TeamRunResult,
  TeamState,
} from '../../models';
import { apiGet, apiSend } from '../client';

export const agentRepository = {
  list: () => apiGet<AgentDef[]>(API_ROUTES.agents),

  get: (id: string) => apiGet<AgentDef>(API_ROUTES.agent(id)),

  create: (body: AgentDefInput) =>
    apiSend<AgentDef>(API_ROUTES.agents, { method: 'POST', body }),

  update: (id: string, body: Partial<AgentDefInput>) =>
    apiSend<AgentDef>(API_ROUTES.agent(id), { method: 'PUT', body }),

  delete: (id: string) =>
    apiSend<{ ok: boolean }>(API_ROUTES.agent(id), { method: 'DELETE' }),
};

export const teamRepository = {
  list: () => apiGet<TeamState[]>(API_ROUTES.teams),

  get: (id: string) => apiGet<TeamState>(API_ROUTES.team(id)),

  run: (body: TeamRunInput) =>
    apiSend<TeamRunResult>(API_ROUTES.teamRun, { method: 'POST', body }),
};
