'use client';

import type { ExecutionEvent, Message } from '@/lib/models';
import {
  HarnessEventList,
  HarnessStageStrip,
} from '@/components/features/observability/EventInspector';
import { MarkdownBody } from '@/components/ui/MarkdownBody';

type Props = {
  messages: Message[];
  streaming: string;
  runEvents?: ExecutionEvent[];
  busy?: boolean;
};

const HARNESS_KINDS = [
  'memory_gate',
  'react_step',
  'tool_call',
  'tool_error',
  'stuck',
  'subagent',
  'team',
  'team_start',
  'team_plan',
  'team_worker',
  'team_complete',
  'condensation',
  'assistant_response',
];

export function ChatMessages({ messages, streaming, runEvents = [], busy }: Props) {
  if (!messages.length && !streaming && !runEvents.length) {
    return (
      <div className="chat-empty">
        <p className="chat-empty-title">New conversation</p>
        <p className="chat-empty-hint">
          Type below to start. MCP tools, workspace, and user memory are ready.
        </p>
      </div>
    );
  }

  const steps = runEvents.filter((e) => HARNESS_KINDS.includes(e.kind));
  const showHarness = busy || steps.length > 0;

  const harness = showHarness ? (
    <div className="agent-iterations" key="harness">
      <div className="agent-iterations-title">
        Harness{' '}
        {busy ? (
          <span className="dim">· running</span>
        ) : (
          <span className="dim">· last turn</span>
        )}
      </div>
      <HarnessStageStrip events={runEvents} busy={busy} />
      {steps.length === 0 && busy ? (
        <div className="agent-iteration-row dim">Waiting for first LLM / tool step…</div>
      ) : (
        <HarnessEventList events={steps} busy={busy} />
      )}
    </div>
  ) : null;

  return (
    <div className="chat-scroll">
      {messages.map((m) => {
        if (m.role === 'system' && m.content.startsWith('[Parity conversation summary]')) {
          return (
            <div
              key={m.id}
              className="msg-tool"
              style={{ borderColor: 'color-mix(in srgb, var(--parity-primary) 35%, transparent)' }}
            >
              <div style={{ color: 'var(--parity-primary)', marginBottom: 4, fontWeight: 600 }}>
                Context condensed
              </div>
              <MarkdownBody text={m.content.replace('[Parity conversation summary]\n', '')} />
            </div>
          );
        }
        if (m.role === 'user') {
          return (
            <div key={m.id} className="msg-user">
              {m.content}
            </div>
          );
        }
        if (m.role === 'tool') {
          return (
            <div key={m.id} className="msg-tool">
              {m.toolName ? <span className="msg-tool-name">[{m.toolName}]</span> : null}{' '}
              <pre className="msg-tool-pre">{m.content}</pre>
            </div>
          );
        }
        return (
          <div key={m.id} className="msg-assistant">
            <MarkdownBody text={m.content} />
          </div>
        );
      })}

      {streaming ? (
        <div className="msg-assistant">
          <MarkdownBody text={streaming} />
        </div>
      ) : null}

      {harness}
    </div>
  );
}
