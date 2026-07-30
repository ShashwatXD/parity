import { API_ROUTES } from '../../constants';
import type { ExecutionEvent, MetricsSummary } from '../../models';
import { apiGet } from '../client';

export const observabilityRepository = {
  events: (runId?: string, sessionId?: string) => {
    const qs = new URLSearchParams();
    if (runId) qs.set('runId', runId);
    if (sessionId) qs.set('sessionId', sessionId);
    const suffix = qs.toString() ? `?${qs}` : '';
    return apiGet<ExecutionEvent[]>(`${API_ROUTES.observabilityEvents}${suffix}`);
  },
  metrics: () => apiGet<MetricsSummary>(API_ROUTES.observabilityMetrics),
};
