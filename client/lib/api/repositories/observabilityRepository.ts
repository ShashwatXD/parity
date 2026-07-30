import { API_ROUTES } from '../../constants';
import type { ExecutionEvent, MetricsSummary } from '../../models';
import { apiGet } from '../client';

export const observabilityRepository = {
  events: () => apiGet<ExecutionEvent[]>(API_ROUTES.observabilityEvents),
  metrics: () => apiGet<MetricsSummary>(API_ROUTES.observabilityMetrics),
};
