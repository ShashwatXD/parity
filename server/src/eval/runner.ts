import { listEvents } from '../observability/timeline.js';
import { scoreRecentRuns, type RunQualityReport } from './rubric.js';
import { runEvalSuite, type EvalSuiteReport } from './suite.js';

export type EvalDashboard = {
  suite: EvalSuiteReport;
  recentRuns: RunQualityReport[];
  aggregate: {
    avgOverall: number | null;
    gradedRuns: number;
    toolErrorRate: number | null;
  };
};

export async function buildEvalDashboard(limit = 8): Promise<EvalDashboard> {
  const suite = await runEvalSuite();
  const events = listEvents();
  const recentRuns = scoreRecentRuns(events, limit);

  const gradedRuns = recentRuns.length;
  const avgOverall =
    gradedRuns === 0
      ? null
      : Math.round(recentRuns.reduce((s, r) => s + r.overall, 0) / gradedRuns);

  const toolCalls = recentRuns.reduce((s, r) => s + r.counts.toolCalls, 0);
  const toolErrors = recentRuns.reduce((s, r) => s + r.counts.toolErrors, 0);
  const toolErrorRate = toolCalls === 0 ? null : Math.round((toolErrors / toolCalls) * 100);

  return {
    suite,
    recentRuns,
    aggregate: { avgOverall, gradedRuns, toolErrorRate },
  };
}

export { runEvalSuite, scoreRecentRuns };
