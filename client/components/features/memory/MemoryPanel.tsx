'use client';

import { useCallback, useEffect, useState } from 'react';
import { Brain, Plus, Search, Trash2 } from 'lucide-react';
import { memoryRepository } from '@/lib/api';
import type { MemoryKind, RetrievalGateDecision, UserMemory } from '@/lib/models';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, PanelCard } from '@/components/ui/Panel';

type Tab = 'all' | 'fact' | 'episode';

export function MemoryPanel() {
  const [tab, setTab] = useState<Tab>('all');
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [gatePreview, setGatePreview] = useState<{
    gate: RetrievalGateDecision;
    hits: number;
  } | null>(null);

  const [draftKind, setDraftKind] = useState<MemoryKind>('fact');
  const [draftSubject, setDraftSubject] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [draftWhen, setDraftWhen] = useState('');

  const refresh = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const kind = tab === 'all' ? undefined : tab;
      const res = await memoryRepository.list(kind);
      setMemories(res.memories);
      setCount(res.count);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [tab]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onCreate() {
    if (!draftContent.trim()) return;
    setBusy(true);
    try {
      await memoryRepository.create({
        kind: draftKind,
        subject: draftSubject.trim() || undefined,
        content: draftContent.trim(),
        happenedAt: draftKind === 'episode' ? draftWhen.trim() || null : null,
      });
      setDraftContent('');
      setDraftSubject('');
      setDraftWhen('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    setBusy(true);
    try {
      await memoryRepository.remove(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onSearch() {
    const q = query.trim();
    if (!q) {
      await refresh();
      setGatePreview(null);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const [search, gate] = await Promise.all([
        memoryRepository.search(q),
        memoryRepository.previewGate(q),
      ]);
      setMemories(search.memories);
      setGatePreview({ gate: gate.gate, hits: gate.memories.length });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="memory-panel pad stack">
      <div className="memory-hero">
        <div className="memory-hero-icon">
          <Brain size={22} />
        </div>
        <div>
          <h2 className="memory-hero-title">User memory</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Durable facts and episodes — gated into the agent only when a turn needs them.
            Separate from codebase RAG.
          </p>
        </div>
        <Badge tone="accent">{count} stored</Badge>
      </div>

      <PanelCard>
        <div className="memory-tabs">
          {(
            [
              ['all', 'All'],
              ['fact', 'Semantic'],
              ['episode', 'Episodic'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={cnTab(tab === id)}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="memory-search-row">
          <input
            className="field"
            placeholder="Search or preview retrieval gate…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void onSearch();
            }}
          />
          <Button variant="secondary" onClick={() => void onSearch()} disabled={busy}>
            <Search size={14} /> Search
          </Button>
        </div>

        {gatePreview ? (
          <div className={cnGate(gatePreview.gate.retrieve)}>
            <strong>Gate · {gatePreview.gate.retrieve ? 'retrieve' : 'skip'}</strong>
            <span className="muted"> — {gatePreview.gate.reason}</span>
            {gatePreview.gate.retrieve ? (
              <span className="muted"> · {gatePreview.hits} hit(s)</span>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="error-text">{error}</p> : null}

        {memories.length === 0 ? (
          <EmptyState
            title={busy ? 'Loading…' : 'No memories yet'}
            description='Add a fact below, or ask the agent: "Remember that I prefer …"'
          />
        ) : (
          <div className="memory-list">
            {memories.map((m) => (
              <div key={m.id} className="memory-row">
                <div className="memory-row-main">
                  <div className="memory-row-meta">
                    <Badge tone={m.kind === 'episode' ? 'accent' : 'default'}>{m.kind}</Badge>
                    {m.subject ? <span className="mono dim">{m.subject}</span> : null}
                    {m.happenedAt ? <span className="dim">{m.happenedAt}</span> : null}
                    <span className="dim">{m.source}</span>
                  </div>
                  <div className="memory-row-content">{m.content}</div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => void onDelete(m.id)}
                  title="Forget"
                  aria-label="Delete memory"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </PanelCard>

      <PanelCard>
        <strong>Add memory</strong>
        <p className="muted" style={{ margin: '6px 0 12px', fontSize: 12 }}>
          Semantic = lasting facts. Episodic = dated events. The agent can also write these via{' '}
          <code>remember</code>.
        </p>
        <div className="memory-form">
          <select
            className="field"
            value={draftKind}
            onChange={(e) => setDraftKind(e.target.value as MemoryKind)}
          >
            <option value="fact">Fact (semantic)</option>
            <option value="episode">Episode (episodic)</option>
          </select>
          <input
            className="field"
            placeholder="Subject (optional) — e.g. raj, editor"
            value={draftSubject}
            onChange={(e) => setDraftSubject(e.target.value)}
          />
          {draftKind === 'episode' ? (
            <input
              className="field"
              placeholder="When — e.g. 2026-07-31"
              value={draftWhen}
              onChange={(e) => setDraftWhen(e.target.value)}
            />
          ) : null}
          <textarea
            className="field"
            rows={3}
            placeholder="Content — what should Parity remember?"
            value={draftContent}
            onChange={(e) => setDraftContent(e.target.value)}
          />
          <Button onClick={() => void onCreate()} disabled={busy || !draftContent.trim()}>
            <Plus size={14} /> Save memory
          </Button>
        </div>
      </PanelCard>
    </div>
  );
}

function cnTab(active: boolean) {
  return `memory-tab${active ? ' is-active' : ''}`;
}

function cnGate(retrieve: boolean) {
  return `memory-gate-banner ${retrieve ? 'is-retrieve' : 'is-skip'}`;
}
