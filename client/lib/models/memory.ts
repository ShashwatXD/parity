export type MemoryKind = 'fact' | 'episode';

export type UserMemory = {
  id: string;
  kind: MemoryKind;
  subject: string;
  content: string;
  happenedAt: string | null;
  source: string;
  createdAt: number;
  updatedAt: number;
};

export type RetrievalGateDecision = {
  retrieve: boolean;
  query: string;
  reason: string;
};

export type MemoryListResponse = {
  memories: UserMemory[];
  count: number;
};

export type MemoryGateResponse = {
  gate: RetrievalGateDecision;
  memories: UserMemory[];
};
