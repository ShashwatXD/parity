export type RubricDimension = {
  id: string;
  label: string;
  score: number;
  weight: number;
  notes: string[];
};

export type RunQualityReport = {
  runId: string;
  sessionId: string | null;
  overall: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  dimensions: RubricDimension[];
  summary: string;
  counts: {
    events: number;
    toolCalls: number;
    toolErrors: number;
    reactSteps: number;
    stuck: number;
    condensations: number;
  };
};

export type EvalCaseResult = {
  id: string;
  name: string;
  category: 'agent' | 'sandbox' | 'context' | 'skills' | 'grounding';
  passed: boolean;
  detail: string;
  durationMs: number;
};

export type EvalSuiteReport = {
  ranAt: number;
  passed: number;
  failed: number;
  total: number;
  passRate: number;
  cases: EvalCaseResult[];
  summary: string;
};

export type GoldenCaseResult = {
  id: string;
  question: string;
  expectPaths: string[];
  topPaths: string[];
  rank: number | null;
  hit: boolean;
  status: 'ok' | 'skipped';
  detail: string;
};

export type GoldenReport = {
  ranAt: number;
  status: 'ok' | 'skipped';
  reason: string | null;
  mode: string;
  k: number;
  cases: GoldenCaseResult[];
  recallAtK: number | null;
  mrr: number | null;
  summary: string;
};

export type EvalDashboard = {
  suite: EvalSuiteReport;
  golden: GoldenReport;
  recentRuns: RunQualityReport[];
  aggregate: {
    avgOverall: number | null;
    gradedRuns: number;
    toolErrorRate: number | null;
    retrievalRecall: number | null;
  };
};
