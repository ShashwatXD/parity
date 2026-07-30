'use client';

import type { ExecutionEvent, MetricsSummary, PluginInfo } from '@/lib/models';
import { Badge } from '@/components/ui/Badge';
import { PanelCard } from '@/components/ui/Panel';

type Props = {
  events: ExecutionEvent[];
  metrics: Partial<MetricsSummary>;
  plugins: PluginInfo[];
};

export function ObservabilityPanel({ events, metrics, plugins }: Props) {
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
