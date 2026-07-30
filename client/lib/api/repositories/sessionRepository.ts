import { API_ROUTES } from '../../constants';
import type { ContextSnapshot, CreateSessionInput, Session, SessionDetail } from '../../models';
import { apiGet, apiSend } from '../client';

export const sessionRepository = {
  list: (q?: string) =>
    apiGet<Session[]>(
      q ? `${API_ROUTES.sessions}?q=${encodeURIComponent(q)}` : API_ROUTES.sessions,
    ),

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

  delete: (id: string) =>
    apiSend<{ ok: boolean }>(API_ROUTES.session(id), { method: 'DELETE' }),
};
