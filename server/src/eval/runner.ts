import { listEvents } from '../observability/timeline.js';
import { runGoldenSuite, type GoldenReport } from './golden.js';
import { scoreRecentRuns, type RunQualityReport } from './rubric.js';
import { runEvalSuite, type EvalSuiteReport } from './suite.js';

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

export async function buildEvalDashboard(limit = 8): Promise<EvalDashboard> {
  const suite = await runEvalSuite();
  const golden = await runGoldenSuite();
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
    golden,
    recentRuns,
    aggregate: {
      avgOverall,
      gradedRuns,
      toolErrorRate,
      retrievalRecall: golden.recallAtK === null ? null : Math.round(golden.recallAtK * 100),
    },
  };
}

export { runEvalSuite, runGoldenSuite, scoreRecentRuns };
