import { API_ROUTES } from '../../constants';
import type { Artifact, BackgroundJob, PluginInfo, SearchResult } from '../../models';
import { apiGet } from '../client';

export const studioRepository = {
  search: (q: string) =>
    apiGet<SearchResult>(`${API_ROUTES.search}?q=${encodeURIComponent(q)}`),

  artifacts: () => apiGet<Artifact[]>(API_ROUTES.artifacts),
  jobs: () => apiGet<BackgroundJob[]>(API_ROUTES.jobs),
  plugins: () => apiGet<PluginInfo[]>(API_ROUTES.plugins),
};
