'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { settingsRepository } from '@/lib/api';
import { PROVIDER_OPTIONS } from '@/lib/constants';
import type {
  AppSettings,
  LlmProfileDraft,
  ProviderId,
  PublicLlmProfile,
  SettingsUpdate,
} from '@/lib/models';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { PanelCard } from '@/components/ui/Panel';

const PROVIDER_COPY: Record<
  ProviderId,
  { blurb: string; keyLabel: string; urlLabel: string; urlPlaceholder: string; showUrl: boolean }
> = {
  openai: {
    blurb: 'OpenAI or compatible APIs (OpenRouter, Azure, Groq…).',
    keyLabel: 'API key',
    urlLabel: 'Base URL (optional)',
    urlPlaceholder: 'https://api.openai.com/v1',
    showUrl: true,
  },
  anthropic: {
    blurb: 'Anthropic Claude models.',
    keyLabel: 'API key',
    urlLabel: 'Base URL (optional)',
    urlPlaceholder: 'https://api.anthropic.com',
    showUrl: true,
  },
  gemini: {
    blurb: 'Google Gemini.',
    keyLabel: 'API key',
    urlLabel: 'Base URL',
    urlPlaceholder: '',
    showUrl: false,
  },
  ollama: {
    blurb: 'Local Ollama — usually no cloud key.',
    keyLabel: 'API key (usually ollama)',
    urlLabel: 'Base URL',
    urlPlaceholder: 'http://127.0.0.1:11434/v1',
    showUrl: true,
  },
  custom: {
    blurb:
      'Any OpenAI-compatible endpoint — OpenRouter, LM Studio, vLLM, Together, Fireworks, Azure-compatible proxies, etc.',
    keyLabel: 'API key',
    urlLabel: 'Base URL (required)',
    urlPlaceholder: 'https://api.example.com/v1',
    showUrl: true,
  },
};

type Draft = {
  id: string;
  name: string;
  provider: ProviderId;
  model: string;
  apiKey: string;
  baseUrl: string;
};

type LlmView = 'list' | 'create' | 'edit';

function toDraft(p: PublicLlmProfile): Draft {
  return {
    id: p.id,
    name: p.name,
    provider: p.provider,
    model: p.model,
    apiKey: '',
    baseUrl: p.baseUrl,
  };
}

function newDraft(): Draft {
  return {
    id: `profile_${crypto.randomUUID()}`,
    name: '',
    provider: 'ollama',
    model: 'qwen2.5:3b',
    apiKey: '',
    baseUrl: 'http://127.0.0.1:11434/v1',
  };
}

function providerDefaults(provider: ProviderId): Partial<Draft> {
  const defaults: Record<ProviderId, Partial<Draft>> = {
    openai: { model: 'gpt-4o-mini', baseUrl: '' },
    anthropic: { model: 'claude-3-5-haiku-latest', baseUrl: '' },
    gemini: { model: 'gemini-2.0-flash', baseUrl: '' },
    ollama: { model: 'qwen2.5:3b', baseUrl: 'http://127.0.0.1:11434/v1' },
    custom: { model: 'my-model', baseUrl: 'https://api.example.com/v1' },
  };
  return defaults[provider];
}

type Props = {
  onSaved?: (settings: AppSettings) => void;
};

export function SettingsPanel({ onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [section, setSection] = useState<'llms' | 'prompts' | 'workspace'>('llms');
  const [llmView, setLlmView] = useState<LlmView>('list');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [condensationPrompt, setCondensationPrompt] = useState('');
  const [maxAgentSteps, setMaxAgentSteps] = useState(16);
  const [workspaceRoot, setWorkspaceRoot] = useState('');
  const [profiles, setProfiles] = useState<Draft[]>([]);
  const [hints, setHints] = useState<Record<string, { set: boolean; hint: string }>>({});
  const [activeProfileId, setActiveProfileId] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [menuId, setMenuId] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  async function load(opts?: { keepView?: boolean }) {
    setLoading(true);
    setError('');
    try {
      const s = await settingsRepository.get();
      setSystemPrompt(s.systemPrompt);
      setCondensationPrompt(s.condensationPrompt);
      setMaxAgentSteps(s.maxAgentSteps);
      setWorkspaceRoot(s.workspaceRoot ?? '');
      const drafts = (s.profiles ?? []).map(toDraft);
      // Always keep at least one profile in memory for the compulsory default
      setProfiles(drafts.length ? drafts : [newDraft()]);
      const nextActive = s.activeProfileId || drafts[0]?.id || '';
      setActiveProfileId(nextActive);
      const nextHints: Record<string, { set: boolean; hint: string }> = {};
      for (const p of s.profiles ?? []) {
        nextHints[p.id] = { set: p.apiKeySet, hint: p.apiKeyHint };
      }
      setHints(nextHints);
      if (!opts?.keepView) {
        setLlmView('list');
        setDraft(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!menuId) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuId('');
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuId]);

  function openCreate() {
    const d = newDraft();
    setDraft(d);
    setLlmView('create');
    setOk('');
    setError('');
    setMenuId('');
  }

  function openEdit(id: string) {
    const p = profiles.find((x) => x.id === id);
    if (!p) return;
    setDraft({ ...p, apiKey: '' });
    setLlmView('edit');
    setOk('');
    setError('');
    setMenuId('');
  }

  function backToList() {
    setLlmView('list');
    setDraft(null);
    setError('');
    setOk('');
  }

  function patchDraft(patch: Partial<Draft>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function persistProfiles(
    nextProfiles: Draft[],
    nextActiveId: string,
    extras?: Partial<SettingsUpdate>,
  ) {
    if (!nextProfiles.length) {
      setError('Keep at least one LLM profile');
      return null;
    }
    setSaving(true);
    setError('');
    setOk('');
    try {
      const active = nextProfiles.find((p) => p.id === nextActiveId) ?? nextProfiles[0]!;
      const body: SettingsUpdate = {
        activeProfileId: active.id,
        defaultProvider: active.provider,
        defaultModel: active.model,
        systemPrompt,
        condensationPrompt,
        maxAgentSteps,
        workspaceRoot,
        ...extras,
        profiles: nextProfiles.map(
          (p): LlmProfileDraft => ({
            id: p.id,
            name: p.name.trim() || p.model.trim() || 'Untitled',
            provider: p.provider,
            model: p.model.trim() || 'model',
            baseUrl: p.baseUrl,
            ...(p.apiKey.trim() ? { apiKey: p.apiKey.trim() } : {}),
          }),
        ),
      };
      const saved = await settingsRepository.update(body);
      onSaved?.(saved);
      return saved;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft() {
    if (!draft) return;
    if (!draft.model.trim()) {
      setError('Model is required');
      return;
    }
    if (draft.provider === 'custom' && !draft.baseUrl.trim()) {
      setError('Base URL is required for custom providers');
      return;
    }
    const named: Draft = {
      ...draft,
      name: draft.name.trim() || draft.model.trim() || 'Untitled',
    };
    const next =
      llmView === 'create'
        ? [...profiles, named]
        : profiles.map((p) => (p.id === named.id ? named : p));
    const saved = await persistProfiles(next, activeProfileId || named.id);
    if (saved) {
      setOk(llmView === 'create' ? 'Profile created' : 'Profile saved');
      await load();
    }
  }

  async function setDefault(id: string) {
    setMenuId('');
    const saved = await persistProfiles(profiles, id);
    if (saved) {
      setActiveProfileId(id);
      setOk('Default profile updated');
      await load({ keepView: true });
    }
  }

  async function removeProfile(id: string) {
    setMenuId('');
    if (profiles.length <= 1) {
      setError('Keep at least one LLM profile');
      return;
    }
    const next = profiles.filter((p) => p.id !== id);
    const nextActive = activeProfileId === id ? next[0]!.id : activeProfileId;
    const saved = await persistProfiles(next, nextActive);
    if (saved) {
      setOk('Profile removed');
      await load();
    }
  }

  async function saveGlobals() {
    const saved = await persistProfiles(profiles, activeProfileId || profiles[0]?.id || '');
    if (saved) {
      setOk('Settings saved');
      await load({ keepView: true });
    }
  }

  if (loading) return <div className="pad muted">Loading settings…</div>;

  const copy = draft ? PROVIDER_COPY[draft.provider] : PROVIDER_COPY.ollama;
  const hint = draft ? hints[draft.id] : undefined;
  const editingInDetail = section === 'llms' && (llmView === 'create' || llmView === 'edit');

  return (
    <div className="pad scroll-y stack">
      {error ? <div className="error-banner">{error}</div> : null}
      {ok ? (
        <div
          className="error-banner"
          style={{
            borderColor: 'color-mix(in srgb, var(--parity-success) 45%, transparent)',
            background: 'color-mix(in srgb, var(--parity-success) 12%, transparent)',
            color: 'var(--parity-success)',
          }}
        >
          {ok}
        </div>
      ) : null}

      {!editingInDetail ? (
        <div className="settings-tabs">
          <button
            type="button"
            className={section === 'llms' ? 'settings-tab active' : 'settings-tab'}
            onClick={() => {
              setSection('llms');
              setLlmView('list');
              setDraft(null);
            }}
          >
            LLMs
          </button>
          <button
            type="button"
            className={section === 'workspace' ? 'settings-tab active' : 'settings-tab'}
            onClick={() => setSection('workspace')}
          >
            Workspace
          </button>
          <button
            type="button"
            className={section === 'prompts' ? 'settings-tab active' : 'settings-tab'}
            onClick={() => setSection('prompts')}
          >
            Prompts
          </button>
        </div>
      ) : null}

      {section === 'llms' && llmView === 'list' ? (
        <PanelCard>
          <div className="stack">
            <div className="llm-list-header">
              <div>
                <strong>Available profiles</strong>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
                  Switch from chat. Add or edit profiles here — keys stay in Settings.
                </p>
              </div>
              <Button variant="secondary" onClick={openCreate}>
                <Plus size={14} /> Add LLM profile
              </Button>
            </div>

            {profiles.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                No profiles yet. Add a profile to save your LLM configuration.
              </p>
            ) : (
              <div className="llm-profile-list">
                {profiles.map((p) => {
                  const isDefault = p.id === activeProfileId;
                  const keyHint = hints[p.id];
                  return (
                    <div key={p.id} className="llm-profile-row">
                      <button
                        type="button"
                        className="llm-profile-row-main"
                        onClick={() => openEdit(p.id)}
                      >
                        <span className="llm-profile-row-name">{p.name || p.model}</span>
                        <span className="llm-profile-row-meta mono">
                          {p.provider}/{p.model}
                        </span>
                      </button>
                      <div className="llm-profile-row-aside">
                        {isDefault ? <Badge tone="accent">Default</Badge> : null}
                        {keyHint?.set ? (
                          <Badge tone="success">Key</Badge>
                        ) : p.provider === 'ollama' ? (
                          <Badge>Local</Badge>
                        ) : null}
                        <div className="llm-row-menu-wrap" ref={menuId === p.id ? menuRef : undefined}>
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label="Profile actions"
                            onClick={() => setMenuId((id) => (id === p.id ? '' : p.id))}
                          >
                            <MoreHorizontal size={15} />
                          </button>
                          {menuId === p.id ? (
                            <div className="llm-row-menu">
                              <button type="button" onClick={() => openEdit(p.id)}>
                                Edit
                              </button>
                              <button
                                type="button"
                                disabled={isDefault}
                                onClick={() => void setDefault(p.id)}
                              >
                                Set as default
                              </button>
                              <button
                                type="button"
                                className="danger"
                                disabled={profiles.length <= 1}
                                onClick={() => void removeProfile(p.id)}
                              >
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </PanelCard>
      ) : null}

      {section === 'llms' && draft && (llmView === 'create' || llmView === 'edit') ? (
        <PanelCard>
          <div className="stack">
            <div className="llm-detail-nav">
              <button type="button" className="llm-back" onClick={backToList}>
                <ArrowLeft size={14} /> Back
              </button>
              <strong>{llmView === 'create' ? 'Add LLM profile' : 'Edit LLM profile'}</strong>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              Configure the provider below, then save. Chat only switches between saved profiles.
            </p>

            <Field label="Profile name">
              <Input
                value={draft.name}
                onChange={(e) => patchDraft({ name: e.target.value })}
                placeholder={draft.model || 'My LLM'}
              />
            </Field>

            <Field label="Provider">
              <Select
                value={draft.provider}
                onChange={(e) => {
                  const provider = e.target.value as ProviderId;
                  patchDraft({ provider, ...providerDefaults(provider) });
                }}
              >
                {PROVIDER_OPTIONS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>

            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              {copy.blurb}
            </p>

            <Field label={copy.keyLabel}>
              <Input
                type="password"
                value={draft.apiKey}
                placeholder={
                  hint?.set
                    ? `Stored ${hint.hint} — enter to replace`
                    : draft.provider === 'ollama'
                      ? 'ollama'
                      : 'Paste API key'
                }
                onChange={(e) => patchDraft({ apiKey: e.target.value })}
                autoComplete="off"
              />
            </Field>

            {copy.showUrl ? (
              <Field label={copy.urlLabel}>
                <Input
                  value={draft.baseUrl}
                  onChange={(e) => patchDraft({ baseUrl: e.target.value })}
                  placeholder={copy.urlPlaceholder}
                />
              </Field>
            ) : null}

            <Field label="Model">
              <Input
                value={draft.model}
                onChange={(e) => patchDraft({ model: e.target.value })}
              />
            </Field>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button variant="primary" disabled={saving} onClick={() => void saveDraft()}>
                {saving ? 'Saving…' : llmView === 'create' ? 'Create profile' : 'Save changes'}
              </Button>
              <Button variant="ghost" disabled={saving} onClick={backToList}>
                Cancel
              </Button>
              {llmView === 'edit' && profiles.length > 1 ? (
                <Button
                  variant="danger"
                  disabled={saving}
                  onClick={() => void removeProfile(draft.id)}
                >
                  <Trash2 size={14} /> Delete
                </Button>
              ) : null}
            </div>
          </div>
        </PanelCard>
      ) : null}

      {section === 'workspace' ? (
        <>
          <PanelCard>
            <div className="stack">
              <strong>Sandbox root</strong>
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                Absolute path the agent may read, write, and shell into. Leave empty to use{' '}
                <span className="mono">server/.data/workspace</span> (or{' '}
                <span className="mono">PARITY_WORKSPACE</span>).
              </p>
              <Field label="Workspace path">
                <Input
                  value={workspaceRoot}
                  onChange={(e) => setWorkspaceRoot(e.target.value)}
                  placeholder="/path/to/project"
                  spellCheck={false}
                />
              </Field>
              <Field label="Max agent steps">
                <Input
                  type="number"
                  min={1}
                  max={64}
                  value={maxAgentSteps}
                  onChange={(e) => setMaxAgentSteps(Number(e.target.value) || 16)}
                />
              </Field>
            </div>
          </PanelCard>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="primary" disabled={saving} onClick={() => void saveGlobals()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="ghost" disabled={saving} onClick={() => void load({ keepView: true })}>
              Discard
            </Button>
          </div>
        </>
      ) : null}

      {section === 'prompts' ? (
        <>
          <PanelCard>
            <div className="stack">
              <strong>System prompt</strong>
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                style={{ minHeight: 160, fontFamily: 'var(--parity-font)' }}
              />
            </div>
          </PanelCard>
          <PanelCard>
            <div className="stack">
              <strong>Condensation prompt</strong>
              <Textarea
                value={condensationPrompt}
                onChange={(e) => setCondensationPrompt(e.target.value)}
                style={{ minHeight: 120, fontFamily: 'var(--parity-font)' }}
              />
            </div>
          </PanelCard>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="primary" disabled={saving} onClick={() => void saveGlobals()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="ghost" disabled={saving} onClick={() => void load({ keepView: true })}>
              Discard
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
