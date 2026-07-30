'use client';

import type { Message } from '@/lib/models';

type Props = {
  messages: Message[];
  streaming: string;
};

export function ChatMessages({ messages, streaming }: Props) {
  if (!messages.length && !streaming) {
    return (
      <div className="chat-empty">
        <p className="chat-empty-title">New conversation</p>
        <p className="chat-empty-hint">Type below to start. MCP tools and your selected LLM are ready.</p>
      </div>
    );
  }

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
      {streaming ? <div className="msg-assistant">{streaming}</div> : null}
    </div>
  );
}
