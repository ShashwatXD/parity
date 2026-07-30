'use client';

import { ArrowUp, Settings2 } from 'lucide-react';
import type { PublicLlmProfile } from '@/lib/models';

type Props = {
  value: string;
  busy: boolean;
  profiles: PublicLlmProfile[];
  profileId: string;
  onChange: (value: string) => void;
  onProfileChange: (profileId: string) => void;
  onSend: () => void;
  onOpenSettings?: () => void;
};

export function ChatComposer({
  value,
  busy,
  profiles,
  profileId,
  onChange,
  onProfileChange,
  onSend,
  onOpenSettings,
}: Props) {
  const active = profiles.find((p) => p.id === profileId) ?? profiles[0];

  return (
    <div className="composer-wrap">
      <div className="composer-box">
        <textarea
          value={value}
          placeholder="Ask Parity to build, debug, or drive MCP tools…"
          rows={2}
          disabled={busy}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <div className="composer-toolbar">
          {profiles.length > 0 ? (
            <select
              className="composer-profile-select"
              value={active?.id ?? ''}
              onChange={(e) => onProfileChange(e.target.value)}
              disabled={busy}
              aria-label="LLM profile"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.provider}/{p.model}
                </option>
              ))}
            </select>
          ) : (
            <button
              type="button"
              className="composer-model-chip"
              onClick={onOpenSettings}
              title="Add LLM profiles in Settings"
            >
              <Settings2 size={13} />
              <span className="composer-model-chip-text">Add LLM in Settings</span>
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onOpenSettings}
            title="Manage LLM profiles"
            aria-label="Settings"
          >
            <Settings2 size={15} />
          </button>
          <button
            type="button"
            className="btn-send"
            disabled={busy || !value.trim() || !active}
            onClick={onSend}
            aria-label="Send"
          >
            <ArrowUp size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
