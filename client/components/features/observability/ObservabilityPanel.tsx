'use client';

import { useCallback, useEffect, useState } from 'react';
import { evalRepository } from '@/lib/api';
import type { EvalDashboard, ExecutionEvent, MetricsSummary, PluginInfo } from '@/lib/models';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PanelCard } from '@/components/ui/Panel';

type Props = {
  events: ExecutionEvent[];
  metrics: Partial<MetricsSummary>;
  plugins: PluginInfo[];
};

export function ObservabilityPanel({ events, metrics, plugins }: Props) {
  const [evals, setEvals] = useState<EvalDashboard | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refreshEvals = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      setEvals(await evalRepository.dashboard());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refreshEvals();
  }, [refreshEvals]);

  async function rerunSuite() {
    setBusy(true);
    setError('');
    try {
      await evalRepository.runSuite();
      setEvals(await evalRepository.dashboard());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pad scroll-y stack">
      <div className="grid-2">
        <PanelCard>
          <strong>Metrics</strong>
          <div className="stack" style={{ marginTop: 10 }}>
            <div>Events: {metrics.events ?? 0}</div>
            <div>Latency: {metrics.totalLatencyMs ?? 0} ms</div>
            <div>
              Tokens: {metrics.promptTokens ?? 0} / {metrics.completionTokens ?? 0}
            </div>
            <div>Est. cost: ${Number(metrics.costUsd ?? 0).toFixed(4)}</div>
          </div>
        </PanelCard>
        <PanelCard>
          <strong>Plugins</strong>
          <div className="stack" style={{ marginTop: 10 }}>
            {plugins.length === 0 ? (
              <span className="muted">None registered</span>
            ) : (
              plugins.map((p) => (
                <div key={p.name}>
                  {p.name} <Badge>{p.version}</Badge>
                </div>
              ))
            )}
          </div>
        </PanelCard>
      </div>

      <PanelCard>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <strong>Agent evaluation</strong>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
              Offline regression suite + rubric scores on recent runs (reliability, completion,
              anti-loop, efficiency).
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" disabled={busy} onClick={() => void refreshEvals()}>
              Refresh
            </Button>
            <Button variant="primary" disabled={busy} onClick={() => void rerunSuite()}>
              {busy ? 'Running…' : 'Run suite'}
            </Button>
          </div>
        </div>
        {error ? <div className="error-banner" style={{ marginTop: 10 }}>{error}</div> : null}

        {evals ? (
          <div className="stack" style={{ marginTop: 12 }}>
            <div className="eval-agg">
              <div>
                <span className="muted">Suite</span>
                <div>
                  <Badge tone={evals.suite.failed ? 'error' : 'success'}>
                    {evals.suite.passed}/{evals.suite.total} ({evals.suite.passRate}%)
                  </Badge>
                </div>
              </div>
              <div>
                <span className="muted">Avg run grade</span>
                <div>
                  {evals.aggregate.avgOverall == null
                    ? '—'
                    : `${evals.aggregate.avgOverall}/100 (${evals.aggregate.gradedRuns} runs)`}
                </div>
              </div>
              <div>
                <span className="muted">Tool error rate</span>
                <div>
                  {evals.aggregate.toolErrorRate == null
                    ? '—'
                    : `${evals.aggregate.toolErrorRate}%`}
                </div>
              </div>
            </div>

            <div className="stack">
              <strong style={{ fontSize: 13 }}>Regression cases</strong>
              {evals.suite.cases.map((c) => (
                <div key={c.id} className="eval-case-row">
                  <Badge tone={c.passed ? 'success' : 'error'}>{c.passed ? 'pass' : 'fail'}</Badge>
                  <span>{c.name}</span>
                  <span className="mono dim">{c.category}</span>
                </div>
              ))}
            </div>

            {evals.recentRuns.length ? (
              <div className="stack">
                <strong style={{ fontSize: 13 }}>Recent run quality</strong>
                {evals.recentRuns.map((r) => (
                  <div key={r.runId} className="eval-run-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span className="mono" style={{ fontSize: 11 }}>
                        {r.runId.slice(0, 18)}…
                      </span>
                      <Badge tone={r.grade === 'A' || r.grade === 'B' ? 'success' : r.grade === 'F' ? 'error' : 'accent'}>
                        {r.grade} · {r.overall}
                      </Badge>
                    </div>
                    <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
                      {r.summary}
                    </p>
                    <div className="eval-dims">
                      {r.dimensions.map((d) => (
                        <span key={d.id} className="eval-dim">
                          {d.label} {d.score}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                No graded runs yet — chat with tools, then refresh.
              </p>
            )}
          </div>
        ) : (
          <p className="muted" style={{ marginTop: 10 }}>
            {busy ? 'Loading evals…' : 'No eval data'}
          </p>
        )}
      </PanelCard>

      <PanelCard>
        <strong>Execution timeline</strong>
        <div className="stack" style={{ marginTop: 10 }}>
          {events.slice(0, 40).map((e) => (
            <div
              key={e.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '110px 1fr auto',
                gap: 10,
                alignItems: 'center',
                fontSize: 12,
              }}
            >
              <span className="mono dim">{e.kind}</span>
              <span>{e.label}</span>
              <Badge tone={e.status === 'error' ? 'error' : 'default'}>
                {e.status} · {e.latencyMs}ms
              </Badge>
            </div>
          ))}
        </div>
      </PanelCard>
    </div>
  );
}
