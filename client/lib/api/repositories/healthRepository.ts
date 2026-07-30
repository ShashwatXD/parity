import { API_ROUTES } from '../../constants';
import type { HealthStatus } from '../../models';
import { apiGet } from '../client';

export const healthRepository = {
  check: () => apiGet<HealthStatus>(API_ROUTES.health),
};
