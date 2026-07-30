import type {
  EvalCaseResult,
  EvalDashboard,
  EvalSuiteReport,
  RunQualityReport,
} from '../../models';
import { apiGet, apiSend } from '../client';
import { API_ROUTES } from '../../constants';

export type { EvalCaseResult, EvalDashboard, EvalSuiteReport, RunQualityReport };

export const evalRepository = {
  dashboard: () => apiGet<EvalDashboard>(API_ROUTES.evals),
  runSuite: () => apiSend<EvalSuiteReport>(API_ROUTES.evalsRun, { method: 'POST' }),
};
