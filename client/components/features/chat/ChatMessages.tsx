'use client';

import type { ExecutionEvent, Message } from '@/lib/models';

type Props = {
  messages: Message[];
  streaming: string;
  runEvents?: ExecutionEvent[];
  busy?: boolean;
};

export function ChatMessages({ messages, streaming, runEvents = [], busy }: Props) {
  if (!messages.length && !streaming && !runEvents.length) {
    return (
      <div className="chat-empty">
        <p className="chat-empty-title">New conversation</p>
        <p className="chat-empty-hint">Type below to start. MCP tools and your selected LLM are ready.</p>
      </div>
    );
  }

  const steps = runEvents.filter((e) =>
    ['react_step', 'tool_call', 'tool_error', 'stuck', 'subagent', 'condensation'].includes(e.kind),
  );

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
              {m.content.replace('[Parity conversation summary]\n', '')}
            </div>
          );
        }
        return (
          <div
            key={m.id}
            className={
              m.role === 'user' ? 'msg-user' : m.role === 'tool' ? 'msg-tool' : 'msg-assistant'
            }
          >
            {m.toolName ? `[${m.toolName}] ` : ''}
            {m.content}
          </div>
        );
      })}

      {(busy || steps.length > 0) && (
        <div className="agent-iterations">
          <div className="agent-iterations-title">
            Agent loop {busy ? <span className="dim">· running</span> : null}
          </div>
          {steps.length === 0 && busy ? (
            <div className="agent-iteration-row dim">Waiting for first LLM / tool step…</div>
          ) : (
            steps.map((e, i) => (
              <div key={e.id} className="agent-iteration-row">
                <span className="mono dim">#{i + 1}</span>
                <span className="mono">{e.kind}</span>
                <span className="agent-iteration-label">{e.label}</span>
                <span className="mono dim">{e.latencyMs}ms</span>
              </div>
            ))
          )}
        </div>
      )}

      {streaming ? <div className="msg-assistant">{streaming}</div> : null}
    </div>
  );
}
