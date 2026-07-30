import { API_ROUTES } from '../../constants';
import type {
  CreateWorkflowInput,
  Workflow,
  WorkflowRunInput,
  WorkflowRunResult,
} from '../../models';
import { apiGet, apiSend } from '../client';

export const workflowRepository = {
  list: () => apiGet<Workflow[]>(API_ROUTES.workflows),

  create: (body: CreateWorkflowInput) =>
    apiSend<Workflow>(API_ROUTES.workflows, { method: 'POST', body }),

  run: (id: string, body: WorkflowRunInput = {}) =>
    apiSend<WorkflowRunResult>(API_ROUTES.workflowRun(id), { method: 'POST', body }),
};
