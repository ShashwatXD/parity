'use client';

import { useCallback, useEffect, useState } from 'react';
import { History, MessageSquare, Pencil, Search, Trash2 } from 'lucide-react';
import { sessionRepository } from '@/lib/api';
import type { HistoryHit, SessionIntelligence } from '@/lib/models';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, PanelCard } from '@/components/ui/Panel';

type Props = {
  activeSessionId: string;
  onOpenSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewChat: () => void;
};

function formatWhen(ts?: number) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function SessionsPanel({
  activeSessionId,
  onOpenSession,
  onDeleteSession,
  onNewChat,
}: Props) {
  const [query, setQuery] = useState('');
  const [sessions, setSessions] = useState<SessionIntelligence[]>([]);
  const [hits, setHits] = useState<HistoryHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const refresh = useCallback(async (q?: string) => {
    setBusy(true);
    setError('');
    try {
      const needle = (q ?? query).trim();
      const [list, history] = await Promise.all([
        sessionRepository.listIntelligent(needle || undefined),
        needle
          ? sessionRepository.searchHistory(needle, { limit: 10 })
          : Promise.resolve({ query: '', gate: { retrieve: false, query: '', reason: '' }, hits: [] }),
      ]);
      setSessions(list);
      setHits(history.hits);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [query]);

  useEffect(() => {
    void refresh('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    await refresh(query);
  }

  async function commitRename(id: string) {
    if (!renameDraft.trim()) {
      setRenamingId(null);
      return;
    }
    setBusy(true);
    try {
      await sessionRepository.rename(id, renameDraft.trim());
      setRenamingId(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sessions-panel stack">
      <PanelCard>
        <div className="sessions-panel-head">
          <div>
            <strong>Session intelligence</strong>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
              Search titles and message content across chats. Auto-titles, topic tags, and
              cross-session history retrieval power the agent&apos;s memory of prior work.
            </p>
          </div>
          <Button variant="primary" onClick={onNewChat}>
            New chat
          </Button>
        </div>

        <form className="sessions-search" onSubmit={(e) => void onSearch(e)}>
          <Search size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sessions & history…"
            aria-label="Search sessions"
          />
          <Button type="submit" disabled={busy}>
            Search
          </Button>
        </form>
        {error ? <p className="error-inline">{error}</p> : null}
      </PanelCard>

      {hits.length > 0 ? (
        <PanelCard>
          <div className="sessions-section-label">
            <History size={14} />
            Matching turns
            <Badge>{hits.length}</Badge>
          </div>
          <div className="stack" style={{ marginTop: 10 }}>
            {hits.map((h) => (
              <button
                key={h.messageId}
                type="button"
                className="history-hit"
                onClick={() => onOpenSession(h.sessionId)}
              >
                <div className="history-hit-meta">
                  <span>{h.sessionTitle}</span>
                  <span className="muted">
                    {h.role} · score {h.score} · {formatWhen(h.createdAt)}
                  </span>
                </div>
                <p>{h.excerpt}</p>
              </button>
            ))}
          </div>
        </PanelCard>
      ) : null}

      <PanelCard>
        <div className="sessions-section-label">
          <MessageSquare size={14} />
          Sessions
          <Badge>{sessions.length}</Badge>
        </div>
        {sessions.length === 0 ? (
          <EmptyState
            title="No sessions yet"
            description="Start a conversation — titles and topics appear here automatically."
          />
        ) : (
          <div className="sessions-grid">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`session-card${s.id === activeSessionId ? ' active' : ''}`}
              >
                <div className="session-card-main">
                  {renamingId === s.id ? (
                    <input
                      className="session-rename-input"
                      value={renameDraft}
                      autoFocus
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void commitRename(s.id);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      onBlur={() => void commitRename(s.id)}
                    />
                  ) : (
                    <button
                      type="button"
                      className="session-card-open"
                      onClick={() => onOpenSession(s.id)}
                    >
                      <strong className="session-card-title">{s.title}</strong>
                      <p className="session-card-preview">
                        {s.preview || 'No messages yet'}
                      </p>
                      <div className="session-card-meta">
                        <span>{s.messageCount} msgs</span>
                        <span>{formatWhen(s.updatedAt)}</span>
                        {s.condensed ? <Badge tone="accent">condensed</Badge> : null}
                        {typeof s.score === 'number' && s.score > 0 ? (
                          <Badge>score {s.score}</Badge>
                        ) : null}
                      </div>
                      {s.topics.length > 0 ? (
                        <div className="session-topics">
                          {s.topics.map((t) => (
                            <span key={t} className="topic-chip">
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </button>
                  )}
                </div>
                <div className="session-card-actions">
                  <Button
                    variant="ghost"
                    icon
                    title="Rename"
                    onClick={() => {
                      setRenamingId(s.id);
                      setRenameDraft(s.title);
                    }}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    icon
                    title="Delete"
                    onClick={() => onDeleteSession(s.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </PanelCard>
    </div>
  );
}
