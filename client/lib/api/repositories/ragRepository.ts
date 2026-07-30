import { API_ROUTES } from '../../constants';
import { apiGet, apiSend } from '../client';

export type RagStatus = {
  root: string;
  chunkCount: number;
  fileCount: number;
  embeddingMode: string;
  updatedAt: number;
  lastError: string | null;
};

export type RagHit = {
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  content: string;
};

export type RagSearchResult = {
  query: string;
  mode: string;
  hits: RagHit[];
  status: RagStatus;
};

export const ragRepository = {
  status: () => apiGet<RagStatus>(API_ROUTES.ragStatus),
  index: (withEmbeddings = true) =>
    apiSend<RagStatus>(API_ROUTES.ragIndex, {
      method: 'POST',
      body: { withEmbeddings },
    }),
  search: (query: string, limit = 8) =>
    apiSend<RagSearchResult>(API_ROUTES.ragSearch, {
      method: 'POST',
      body: { query, limit },
    }),
};
