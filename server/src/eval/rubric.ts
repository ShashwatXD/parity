import type { ExecutionEvent } from '../models.js';

export type RubricDimension = {
  id: string;
  label: string;
  score: number; // 0–100
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

function gradeFromScore(score: number): RunQualityReport['grade'] {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 55) return 'D';
  return 'F';
}

function weightedAverage(dims: RubricDimension[]): number {
  const w = dims.reduce((s, d) => s + d.weight, 0) || 1;
  return Math.round(dims.reduce((s, d) => s + d.score * d.weight, 0) / w);
}

/** Heuristic rubric over a single agent run's timeline events. */
export function scoreRun(events: ExecutionEvent[]): RunQualityReport | null {
  if (!events.length) return null;
  const runId = events[0]!.runId;
  const sessionId = events[0]!.sessionId;

  const toolCalls = events.filter((e) => e.kind === 'tool_call' || e.kind === 'tool_error');
  const toolErrors = events.filter((e) => e.kind === 'tool_error' || e.status === 'error');
  const reactSteps = events.filter((e) => e.kind === 'react_step');
  const stuck = events.filter((e) => e.kind === 'stuck');
  const condensations = events.filter((e) => e.kind === 'condensation');
  const assistant = events.filter((e) => e.kind === 'assistant_response');
  const completed = assistant.length > 0;

  const reliabilityNotes: string[] = [];
  let reliability = 100;
  if (toolCalls.length) {
    const errRate = toolErrors.length / Math.max(toolCalls.length, 1);
    reliability = Math.round(100 * (1 - Math.min(errRate, 1)));
    if (errRate > 0.25) reliabilityNotes.push(`High tool error rate (${Math.round(errRate * 100)}%)`);
    else if (errRate === 0) reliabilityNotes.push('No tool errors');
    else reliabilityNotes.push(`${toolErrors.length}/${toolCalls.length} tool failures`);
  } else {
    reliabilityNotes.push('No tools used this run');
    reliability = completed ? 85 : 40;
  }

  const progressNotes: string[] = [];
  let progress = completed ? 90 : 45;
  if (!completed) progressNotes.push('No assistant_response event');
  else progressNotes.push('Run completed with assistant response');
  if (reactSteps.length > 12) {
    progress = Math.max(40, progress - 20);
    progressNotes.push(`Long ReAct trail (${reactSteps.length} steps)`);
  } else if (reactSteps.length > 0) {
    progressNotes.push(`${reactSteps.length} ReAct steps`);
  }

  const stuckNotes: string[] = [];
  let stuckScore = 100;
  if (stuck.length) {
    stuckScore = Math.max(20, 100 - stuck.length * 35);
    stuckNotes.push(`${stuck.length} stuck-detector warning(s)`);
  } else {
    stuckNotes.push('No stuck loops detected');
  }

  const efficiencyNotes: string[] = [];
  const totalLatency = events.reduce((s, e) => s + (e.latencyMs || 0), 0);
  let efficiency = 80;
  if (totalLatency > 60_000) {
    efficiency = 50;
    efficiencyNotes.push(`High cumulative latency (${Math.round(totalLatency / 1000)}s)`);
  } else if (totalLatency > 20_000) {
    efficiency = 65;
    efficiencyNotes.push(`Moderate latency (${Math.round(totalLatency / 1000)}s)`);
  } else {
    efficiencyNotes.push(`Latency ${totalLatency}ms across events`);
  }
  if (condensations.length) {
    efficiency = Math.min(100, efficiency + 5);
    efficiencyNotes.push(`${condensations.length} context condensation(s)`);
  }

  const dimensions: RubricDimension[] = [
    { id: 'reliability', label: 'Tool reliability', score: reliability, weight: 0.35, notes: reliabilityNotes },
    { id: 'progress', label: 'Task completion', score: progress, weight: 0.3, notes: progressNotes },
    { id: 'anti_stuck', label: 'Anti-loop behavior', score: stuckScore, weight: 0.2, notes: stuckNotes },
    { id: 'efficiency', label: 'Efficiency', score: efficiency, weight: 0.15, notes: efficiencyNotes },
  ];

  const overall = weightedAverage(dimensions);
  const grade = gradeFromScore(overall);
  const summary = `Run ${runId.slice(0, 12)}… grade ${grade} (${overall}/100) — ${toolCalls.length} tools, ${toolErrors.length} errors, ${stuck.length} stuck.`;

  return {
    runId,
    sessionId,
    overall,
    grade,
    dimensions,
    summary,
    counts: {
      events: events.length,
      toolCalls: toolCalls.length,
      toolErrors: toolErrors.length,
      reactSteps: reactSteps.length,
      stuck: stuck.length,
      condensations: condensations.length,
    },
  };
}

export function scoreRecentRuns(allEvents: ExecutionEvent[], limit = 8): RunQualityReport[] {
  const byRun = new Map<string, ExecutionEvent[]>();
  for (const e of allEvents) {
    const list = byRun.get(e.runId) ?? [];
    list.push(e);
    byRun.set(e.runId, list);
  }
  const reports: RunQualityReport[] = [];
  for (const [, evs] of byRun) {
    const sorted = [...evs].sort((a, b) => a.createdAt - b.createdAt);
    const report = scoreRun(sorted);
    if (report) reports.push(report);
  }
  return reports
    .sort((a, b) => {
      const aMax = Math.max(...(byRun.get(a.runId)?.map((e) => e.createdAt) ?? [0]));
      const bMax = Math.max(...(byRun.get(b.runId)?.map((e) => e.createdAt) ?? [0]));
      return bMax - aMax;
    })
    .slice(0, limit);
}
