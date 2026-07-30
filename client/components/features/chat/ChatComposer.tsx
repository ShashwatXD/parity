'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, ChevronDown, Settings2 } from 'lucide-react';
import type { PublicLlmProfile } from '@/lib/models';
import { cn } from '@/lib/utils/cn';

const LABEL_MAX = 18;

function truncateLabel(label: string): string {
  return label.length <= LABEL_MAX ? label : `${label.slice(0, LABEL_MAX)}…`;
}

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
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function selectProfile(id: string) {
    if (id !== active?.id) onProfileChange(id);
    setOpen(false);
  }

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
          <div className="composer-llm-picker" ref={menuRef}>
            <button
              type="button"
              className="composer-llm-pill"
              disabled={busy}
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <span className="composer-llm-pill-text">
                {active ? truncateLabel(active.name) : 'Select a model'}
              </span>
              <ChevronDown size={13} />
            </button>

            {open ? (
              <div className="composer-llm-menu" role="menu">
                {profiles.length > 0 ? (
                  <>
                    <div className="composer-llm-menu-label">Available profiles</div>
                    {profiles.map((p) => {
                      const isCurrent = p.id === active?.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          role="menuitem"
                          className={cn('composer-llm-option', isCurrent && 'active')}
                          onClick={() => selectProfile(p.id)}
                        >
                          <span className="composer-llm-option-top">
                            <span className="composer-llm-option-name">{p.name}</span>
                            {isCurrent ? <Check size={14} /> : null}
                          </span>
                          <span className="composer-llm-option-meta">
                            {p.provider}/{p.model}
                          </span>
                        </button>
                      );
                    })}
                    <div className="composer-llm-menu-divider" />
                  </>
                ) : (
                  <div className="composer-llm-empty">No profiles yet</div>
                )}
                <button
                  type="button"
                  className="composer-llm-settings-link"
                  onClick={() => {
                    setOpen(false);
                    onOpenSettings?.();
                  }}
                >
                  <Settings2 size={14} />
                  LLM profiles
                </button>
              </div>
            ) : null}
          </div>

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
