'use client';

import { useMemo, useState } from 'react';
import type { ExecutionEvent } from '@/lib/models';
import { MarkdownBody } from '@/components/ui/MarkdownBody';
import { cn } from '@/lib/utils/cn';

export function parseDetail(detailJson?: string | null): Record<string, unknown> | null {
  if (!detailJson) return null;
  try {
    const parsed = JSON.parse(detailJson) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function pretty(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function hitCount(detail: Record<string, unknown> | null): number {
  const hits = detail?.hits;
  return Array.isArray(hits) ? hits.length : 0;
}

function chipTone(kind: string, status: string): string {
  if (status === 'error' || kind === 'tool_error' || kind === 'stuck') return 'error';
  if (kind === 'memory_gate') return 'memory';
  if (kind === 'tool_call' || kind === 'subagent') return 'tool';
  if (kind === 'react_step' || kind === 'assistant_response') return 'step';
  if (kind === 'condensation') return 'soft';
  return 'default';
}

function chipLabel(e: ExecutionEvent, detail: Record<string, unknown> | null): string {
  if (e.kind === 'memory_gate') {
    const decision = detail?.decision === 'retrieve' ? 'retrieve' : 'skip';
    const n = hitCount(detail);
    if (decision === 'retrieve') {
      return n > 0 ? `memory · retrieve · ${n} hit${n === 1 ? '' : 's'}` : 'memory · retrieve · 0 hits';
    }
    return 'memory · skip';
  }
  if (e.kind === 'tool_call' || e.kind === 'tool_error') {
    return `tool · ${e.label}`;
  }
  if (e.kind === 'assistant_response') return 'LLM reply';
  if (e.kind === 'react_step') {
    const tools = detail?.toolCalls;
    if (Array.isArray(tools) && tools.length > 0) {
      return e.label || `LLM · ${tools.join(', ')}`;
    }
    return e.label || 'LLM · answer (no tools)';
  }
  return e.label;
}

type ChipProps = {
  event: ExecutionEvent;
  compact?: boolean;
  defaultOpen?: boolean;
};

/** Clickable harness chip — expands to show args / results / gate detail. */
export function EventChip({ event, compact, defaultOpen = false }: ChipProps) {
  const [open, setOpen] = useState(defaultOpen);
  const detail = useMemo(() => parseDetail(event.detailJson), [event.detailJson]);
  const tone = chipTone(event.kind, event.status);
  const label = chipLabel(event, detail);
  const hasDetail = Boolean(detail && Object.keys(detail).length);

  const args = detail?.args;
  const hits = detail?.hits;
  const result = detail?.result ?? detail?.message;
  const decision = detail?.decision;
  const reason = detail?.reason;
  const toolCalls = detail?.toolCalls;
  const replyText =
    typeof detail?.text === 'string'
      ? detail.text
      : typeof detail?.preview === 'string'
        ? detail.preview
        : null;
  const showHits = decision === 'retrieve' && Array.isArray(hits);
  // Don't pretty-render assistant prose in chips — harness JSON section owns that.
  const showInlineReply = Boolean(replyText) && event.kind !== 'assistant_response';

  return (
    <div className={cn('event-chip-wrap', open && 'is-open')}>
      <button
        type="button"
        className={cn('event-chip', `tone-${tone}`, compact && 'compact')}
        onClick={() => hasDetail && setOpen((v) => !v)}
        aria-expanded={open}
        title={hasDetail ? 'Click to inspect' : label}
        disabled={!hasDetail}
      >
        <span className="event-chip-label">{label}</span>
        {event.latencyMs > 0 ? (
          <span className="event-chip-meta">{event.latencyMs}ms</span>
        ) : null}
        {hasDetail ? <span className="event-chip-caret">{open ? '▾' : '▸'}</span> : null}
      </button>
      {open && detail ? (
        <div className="event-chip-detail">
          {decision != null ? (
            <div className="event-chip-kv">
              <span className="dim">decision</span>
              <span className="mono">
                {String(decision)}
                {reason ? ` — ${String(reason)}` : ''}
              </span>
            </div>
          ) : null}
          {Array.isArray(toolCalls) ? (
            <div className="event-chip-kv">
              <span className="dim">tools this step</span>
              <span className="mono">
                {toolCalls.length ? toolCalls.map(String).join(', ') : '(none)'}
              </span>
            </div>
          ) : null}
          {args != null ? (
            <div className="event-chip-block">
              <div className="event-chip-block-title">args</div>
              <pre>{pretty(args)}</pre>
            </div>
          ) : null}
          {showHits ? (
            <div className="event-chip-block">
              <div className="event-chip-block-title">memory hits (in prompt)</div>
              <pre>{pretty(hits).slice(0, 4000)}</pre>
            </div>
          ) : null}
          {showInlineReply ? (
            <div className="event-chip-block">
              <div className="event-chip-block-title">reply</div>
              <div className="harness-reply-md">
                <MarkdownBody text={replyText!} />
              </div>
            </div>
          ) : null}
          {result != null && !showInlineReply ? (
            <div className="event-chip-block">
              <div className="event-chip-block-title">
                {detail.message ? 'message' : 'result'}
              </div>
              <pre>{pretty(result).slice(0, 4000)}</pre>
            </div>
          ) : null}
          {decision == null &&
          args == null &&
          !showHits &&
          !showInlineReply &&
          result == null &&
          toolCalls == null ? (
            <div className="event-chip-block">
              <pre>{pretty(detail).slice(0, 4000)}</pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type StageStripProps = {
  events: ExecutionEvent[];
  busy?: boolean;
};

export function HarnessStageStrip({ events, busy }: StageStripProps) {
  const gate = events.find((e) => e.kind === 'memory_gate');
  const tools = events.filter((e) =>
    ['tool_call', 'tool_error', 'subagent'].includes(e.kind),
  );
  const gateDetail = parseDetail(gate?.detailJson);
  const hits = hitCount(gateDetail);
  const gateDecision =
    gateDetail?.decision === 'retrieve'
      ? hits > 0
        ? `retrieve · ${hits}`
        : 'retrieve'
      : gate
        ? 'skip'
        : busy
          ? '…'
          : null;

  return (
    <div className="harness-stages">
      <span className={cn('harness-stage', gate ? 'done' : busy ? 'on' : '')}>
        gate{gateDecision ? ` · ${gateDecision}` : ''}
      </span>
      {tools.length === 0 && !busy ? (
        <span className="harness-stage done">no tools</span>
      ) : null}
      {tools.map((e) => (
        <EventChip key={e.id} event={e} compact />
      ))}
      <span className={cn('harness-stage', !busy && events.length ? 'done' : busy ? 'on' : '')}>
        reply
      </span>
    </div>
  );
}

type HarnessListProps = {
  events: ExecutionEvent[];
  busy?: boolean;
};

/** Full turn report: memory → tools → LLM payload as JSON (chat already shows prose). */
export function HarnessEventList({ events, busy }: HarnessListProps) {
  const gate = events.find((e) => e.kind === 'memory_gate');
  const gateDetail = parseDetail(gate?.detailJson);
  const tools = events.filter((e) =>
    ['tool_call', 'tool_error', 'subagent', 'stuck'].includes(e.kind),
  );
  const llmSteps = events.filter((e) => e.kind === 'react_step');
  const response = events.find((e) => e.kind === 'assistant_response');
  const responseDetail = parseDetail(response?.detailJson);

  const retrieved = gateDetail?.decision === 'retrieve';
  const hits = Array.isArray(gateDetail?.hits) ? gateDetail.hits : [];
  const tokensIn = response?.tokensPrompt || llmSteps.at(-1)?.tokensPrompt || 0;
  const tokensOut = response?.tokensCompletion || llmSteps.at(-1)?.tokensCompletion || 0;
  const latency = response?.latencyMs || 0;

  const llmJson = {
    rounds: llmSteps.map((e, i) => {
      const d = parseDetail(e.detailJson) ?? {};
      return {
        step: i + 1,
        label: e.label,
        finishReason: d.finishReason ?? null,
        toolCalls: d.toolCalls ?? [],
        toolResultCount: d.toolResultCount ?? 0,
        tokensPrompt: e.tokensPrompt,
        tokensCompletion: e.tokensCompletion,
        latencyMs: e.latencyMs,
      };
    }),
    final: response
      ? {
          kind: 'assistant_response',
          text: responseDetail?.text ?? responseDetail?.preview ?? null,
          finishReason: responseDetail?.finishReason ?? null,
          tokensPrompt: response.tokensPrompt,
          tokensCompletion: response.tokensCompletion,
          latencyMs: response.latencyMs,
          costUsd: response.costUsd ?? responseDetail?.costUsd ?? 0,
        }
      : null,
  };

  return (
    <div className="harness-report">
      <div className="harness-summary">
        <div className="harness-stat">
          <span className="harness-stat-label">Memory</span>
          <span className="harness-stat-value">
            {gate
              ? retrieved
                ? `retrieve · ${hits.length} hit${hits.length === 1 ? '' : 's'}`
                : 'skip'
              : busy
                ? '…'
                : '—'}
          </span>
        </div>
        <div className="harness-stat">
          <span className="harness-stat-label">Tools</span>
          <span className="harness-stat-value">
            {tools.length ? tools.map((t) => t.label).join(', ') : 'none'}
          </span>
        </div>
        <div className="harness-stat">
          <span className="harness-stat-label">LLM rounds</span>
          <span className="harness-stat-value">{llmSteps.length || (busy ? '…' : 0)}</span>
        </div>
        <div className="harness-stat">
          <span className="harness-stat-label">Tokens</span>
          <span className="harness-stat-value mono">
            {tokensIn || tokensOut ? `${tokensIn}→${tokensOut}` : busy ? '…' : '—'}
            {latency ? ` · ${latency}ms` : ''}
          </span>
        </div>
      </div>

      <div className="harness-section">
        <div className="harness-section-title">1 · Memory gate</div>
        {gate ? (
          <>
            <EventChip event={gate} defaultOpen={retrieved} />
            {!retrieved ? (
              <p className="harness-empty muted">
                Skipped — no user memory added to the prompt for this turn.
              </p>
            ) : null}
          </>
        ) : (
          <p className="harness-empty muted">{busy ? 'Deciding…' : 'No gate event'}</p>
        )}
      </div>

      <div className="harness-section">
        <div className="harness-section-title">2 · Tools</div>
        {tools.length === 0 ? (
          <p className="harness-empty muted">
            None — model answered without tool calls this turn.
          </p>
        ) : (
          <div className="agent-chip-list">
            {tools.map((e) => (
              <EventChip key={e.id} event={e} defaultOpen />
            ))}
          </div>
        )}
      </div>

      <div className="harness-section">
        <div className="harness-section-title">3 · LLM response (JSON)</div>
        {llmSteps.length || response ? (
          <pre className="harness-json">{pretty(llmJson)}</pre>
        ) : busy ? (
          <p className="harness-empty muted">Waiting for LLM payload…</p>
        ) : (
          <p className="harness-empty muted">No LLM events for this run.</p>
        )}
      </div>
    </div>
  );
}

type TimelineRowProps = {
  event: ExecutionEvent;
};

export function TimelineEventRow({ event }: TimelineRowProps) {
  return (
    <div className="timeline-event-row">
      <span className="mono dim timeline-kind">{event.kind}</span>
      <div className="timeline-event-body">
        <EventChip event={event} />
      </div>
      <span className="mono dim timeline-latency">{event.latencyMs}ms</span>
    </div>
  );
}
