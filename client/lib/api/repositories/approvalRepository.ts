import { API_ROUTES } from '../../constants';
import type { Approval } from '../../models';
import { apiGet, apiSend } from '../client';

export const approvalRepository = {
  list: (status?: string) =>
    apiGet<Approval[]>(
      status
        ? `${API_ROUTES.approvals}?status=${encodeURIComponent(status)}`
        : API_ROUTES.approvals,
    ),

  listPending: () => approvalRepository.list('pending'),

  resolve: (id: string, body: { status: 'approved' | 'rejected'; note?: string }) =>
    apiSend(API_ROUTES.approvalResolve(id), { method: 'POST', body }),
};
