import { API_ROUTES } from '../../constants';
import type {
  ContextSnapshot,
  CreateSessionInput,
  HistorySearchResult,
  Session,
  SessionDetail,
  SessionIntelligence,
} from '../../models';
import { apiGet, apiSend } from '../client';

export const sessionRepository = {
  list: (q?: string) =>
    apiGet<Session[]>(
      q ? `${API_ROUTES.sessions}?q=${encodeURIComponent(q)}` : API_ROUTES.sessions,
    ),

  listIntelligent: (q?: string) => {
    const params = new URLSearchParams({ intelligent: '1' });
    if (q?.trim()) params.set('q', q.trim());
    return apiGet<SessionIntelligence[]>(`${API_ROUTES.sessions}?${params}`);
  },

  searchHistory: (q: string, opts?: { excludeSessionId?: string; limit?: number }) => {
    const params = new URLSearchParams({ q });
    if (opts?.excludeSessionId) params.set('excludeSessionId', opts.excludeSessionId);
    if (opts?.limit) params.set('limit', String(opts.limit));
    return apiGet<HistorySearchResult>(`${API_ROUTES.historySearch}?${params}`);
  },

  get: (id: string) => apiGet<SessionDetail>(API_ROUTES.session(id)),

  context: (id: string, opts?: { provider?: string; model?: string }) => {
    const params = new URLSearchParams();
    if (opts?.provider) params.set('provider', opts.provider);
    if (opts?.model) params.set('model', opts.model);
    const qs = params.toString();
    return apiGet<ContextSnapshot>(
      `${API_ROUTES.sessionContext(id)}${qs ? `?${qs}` : ''}`,
    );
  },

  create: (body: CreateSessionInput = {}) =>
    apiSend<Session>(API_ROUTES.sessions, { method: 'POST', body }),

  rename: (id: string, title: string) =>
    apiSend<Session>(API_ROUTES.session(id), { method: 'PATCH', body: { title } }),

  delete: (id: string) =>
    apiSend<{ ok: boolean }>(API_ROUTES.session(id), { method: 'DELETE' }),
};
