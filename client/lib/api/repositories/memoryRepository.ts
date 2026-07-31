import { apiGet, apiSend } from '../client';
import { API_ROUTES } from '../../constants';
import type {
  MemoryGateResponse,
  MemoryKind,
  MemoryListResponse,
  UserMemory,
} from '../../models';

export const memoryRepository = {
  list: (kind?: MemoryKind) =>
    apiGet<MemoryListResponse>(
      kind ? `${API_ROUTES.memories}?kind=${kind}` : API_ROUTES.memories,
    ),

  create: (body: {
    kind?: MemoryKind;
    subject?: string;
    content: string;
    happenedAt?: string | null;
  }) => apiSend<UserMemory>(API_ROUTES.memories, { method: 'POST', body }),

  update: (
    id: string,
    body: {
      kind?: MemoryKind;
      subject?: string;
      content?: string;
      happenedAt?: string | null;
    },
  ) => apiSend<UserMemory>(API_ROUTES.memory(id), { method: 'PUT', body }),

  remove: (id: string) =>
    apiSend<{ ok: boolean }>(API_ROUTES.memory(id), { method: 'DELETE' }),

  search: (query: string, limit?: number) =>
    apiSend<{ memories: UserMemory[] }>(API_ROUTES.memorySearch, {
      method: 'POST',
      body: { query, limit },
    }),

  previewGate: (message: string) =>
    apiSend<MemoryGateResponse>(API_ROUTES.memoryGate, {
      method: 'POST',
      body: { message },
    }),
};
