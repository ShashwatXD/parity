'use client';

import type { ContextSnapshot } from '@/lib/models';
import { Badge } from '@/components/ui/Badge';

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

type Props = {
  context: ContextSnapshot | null;
};

export function ContextMeter({ context }: Props) {
  if (!context) return null;

  const pct = Math.min(100, context.percentUsed);
  const tone =
    pct >= 90
      ? 'var(--parity-status-error)'
      : pct >= 75
        ? 'var(--parity-primary)'
        : 'var(--parity-status-success)';

  return (
    <div
      className="context-meter"
      title={
        context.condensed
          ? `Condensed · ${context.summaryPreview ?? 'summary stored'}`
          : `Estimated ${context.usedTokens} / ${context.budgetTokens} tokens`
      }
    >
      <div className="context-meter-bar-wrap">
        <div className="context-meter-labels">
          <span>Context</span>
          <span className="mono">
            {formatTokens(context.usedTokens)}/{formatTokens(context.budgetTokens)}
          </span>
        </div>
        <div className="context-meter-track">
          <div className="context-meter-fill" style={{ width: `${pct}%`, background: tone }} />
        </div>
      </div>
      {context.condensed ? <Badge tone="accent">Summarized</Badge> : null}
      {context.overSoftLimit && !context.condensed ? <Badge tone="error">Near limit</Badge> : null}
    </div>
  );
}
