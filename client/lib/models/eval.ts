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
  category: 'agent' | 'sandbox' | 'context' | 'skills';
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

export type EvalDashboard = {
  suite: EvalSuiteReport;
  recentRuns: RunQualityReport[];
  aggregate: {
    avgOverall: number | null;
    gradedRuns: number;
    toolErrorRate: number | null;
  };
};
