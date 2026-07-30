'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
    name: 'New LLM',
    provider: 'ollama',
    model: 'qwen2.5:3b',
    apiKey: '',
    baseUrl: 'http://127.0.0.1:11434/v1',
  };
}

type Props = {
  onSaved?: (settings: AppSettings) => void;
};

export function SettingsPanel({ onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [section, setSection] = useState<'llms' | 'prompts'>('llms');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [condensationPrompt, setCondensationPrompt] = useState('');
  const [maxAgentSteps, setMaxAgentSteps] = useState(8);
  const [profiles, setProfiles] = useState<Draft[]>([]);
  const [hints, setHints] = useState<Record<string, { set: boolean; hint: string }>>({});
  const [activeProfileId, setActiveProfileId] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const selected = profiles.find((p) => p.id === selectedId) ?? profiles[0];
  const copy = selected ? PROVIDER_COPY[selected.provider] : PROVIDER_COPY.ollama;
  const hint = selected ? hints[selected.id] : undefined;

  async function load() {
    setLoading(true);
    setError('');
    try {
      const s = await settingsRepository.get();
      setSystemPrompt(s.systemPrompt);
      setCondensationPrompt(s.condensationPrompt);
      setMaxAgentSteps(s.maxAgentSteps);
      const drafts = (s.profiles ?? []).map(toDraft);
      setProfiles(drafts.length ? drafts : [newDraft()]);
      const nextActive = s.activeProfileId || drafts[0]?.id || '';
      setActiveProfileId(nextActive);
      setSelectedId(nextActive || drafts[0]?.id || '');
      const nextHints: Record<string, { set: boolean; hint: string }> = {};
      for (const p of s.profiles ?? []) {
        nextHints[p.id] = { set: p.apiKeySet, hint: p.apiKeyHint };
      }
      setHints(nextHints);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function patchSelected(patch: Partial<Draft>) {
    if (!selected) return;
    setProfiles((prev) =>
      prev.map((p) => (p.id === selected.id ? { ...p, ...patch } : p)),
    );
  }

  function addProfile() {
    const draft = newDraft();
    setProfiles((prev) => [...prev, draft]);
    setSelectedId(draft.id);
    setOk('');
  }

  function removeSelected() {
    if (!selected || profiles.length <= 1) {
      setError('Keep at least one LLM profile');
      return;
    }
    const next = profiles.filter((p) => p.id !== selected.id);
    setProfiles(next);
    const fallback = next[0]!.id;
    setSelectedId(fallback);
    if (activeProfileId === selected.id) setActiveProfileId(fallback);
  }

  async function save() {
    if (!profiles.length) {
      setError('Add at least one LLM profile');
      return;
    }
    setSaving(true);
    setError('');
    setOk('');
    try {
      const active = profiles.find((p) => p.id === activeProfileId) ?? profiles[0]!;
      const body: SettingsUpdate = {
        activeProfileId: active.id,
        defaultProvider: active.provider,
        defaultModel: active.model,
        systemPrompt,
        condensationPrompt,
        maxAgentSteps,
        profiles: profiles.map(
          (p): LlmProfileDraft => ({
            id: p.id,
            name: p.name.trim() || 'Untitled',
            provider: p.provider,
            model: p.model.trim() || 'model',
            baseUrl: p.baseUrl,
            ...(p.apiKey.trim() ? { apiKey: p.apiKey.trim() } : {}),
          }),
        ),
      };
      const saved = await settingsRepository.update(body);
      setOk('LLM profiles saved');
      onSaved?.(saved);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="pad muted">Loading settings…</div>;

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

      <div className="settings-tabs">
        <button
          type="button"
          className={section === 'llms' ? 'settings-tab active' : 'settings-tab'}
          onClick={() => setSection('llms')}
        >
          LLMs
        </button>
        <button
          type="button"
          className={section === 'prompts' ? 'settings-tab active' : 'settings-tab'}
          onClick={() => setSection('prompts')}
        >
          Prompts
        </button>
      </div>

      {section === 'llms' && selected ? (
        <>
          <PanelCard>
            <div className="stack">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong style={{ flex: 1 }}>Saved LLMs</strong>
                <Button variant="secondary" onClick={addProfile}>
                  <Plus size={14} /> Add
                </Button>
              </div>
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                Create multiple profiles, then pick one from chat. Keys are edited only here.
              </p>
              <div className="provider-pills">
                {profiles.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={selectedId === p.id ? 'provider-pill active' : 'provider-pill'}
                    onClick={() => setSelectedId(p.id)}
                  >
                    {p.name}
                    {activeProfileId === p.id ? <span className="provider-pill-dot" /> : null}
                  </button>
                ))}
              </div>
            </div>
          </PanelCard>

          <PanelCard>
            <div className="stack">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <strong>Edit profile</strong>
                {hint?.set ? (
                  <Badge tone="success">Key {hint.hint || 'set'}</Badge>
                ) : selected.provider === 'ollama' ? (
                  <Badge tone="accent">Local</Badge>
                ) : selected.provider === 'custom' ? (
                  <Badge tone="accent">Compatible</Badge>
                ) : (
                  <Badge>No key</Badge>
                )}
                {activeProfileId === selected.id ? <Badge tone="accent">Default</Badge> : null}
              </div>

              <Field label="Display name">
                <Input
                  value={selected.name}
                  onChange={(e) => patchSelected({ name: e.target.value })}
                />
              </Field>

              <Field label="Provider">
                <Select
                  value={selected.provider}
                  onChange={(e) => {
                    const provider = e.target.value as ProviderId;
                    const defaults: Record<ProviderId, Partial<Draft>> = {
                      openai: { model: 'gpt-4o-mini', baseUrl: '' },
                      anthropic: { model: 'claude-3-5-haiku-latest', baseUrl: '' },
                      gemini: { model: 'gemini-2.0-flash', baseUrl: '' },
                      ollama: {
                        model: 'qwen2.5:3b',
                        baseUrl: 'http://127.0.0.1:11434/v1',
                      },
                      custom: {
                        model: 'my-model',
                        baseUrl: 'https://api.example.com/v1',
                      },
                    };
                    patchSelected({ provider, ...defaults[provider] });
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
                  value={selected.apiKey}
                  placeholder={
                    hint?.set
                      ? `Stored ${hint.hint} — enter to replace`
                      : selected.provider === 'ollama'
                        ? 'ollama'
                        : 'Paste API key'
                  }
                  onChange={(e) => patchSelected({ apiKey: e.target.value })}
                  autoComplete="off"
                />
              </Field>

              {copy.showUrl ? (
                <Field label={copy.urlLabel}>
                  <Input
                    value={selected.baseUrl}
                    onChange={(e) => patchSelected({ baseUrl: e.target.value })}
                    placeholder={copy.urlPlaceholder}
                  />
                </Field>
              ) : null}

              <Field label="Model">
                <Input
                  value={selected.model}
                  onChange={(e) => patchSelected({ model: e.target.value })}
                />
              </Field>

              <Field label="Max agent steps">
                <Input
                  type="number"
                  min={1}
                  max={32}
                  value={maxAgentSteps}
                  onChange={(e) => setMaxAgentSteps(Number(e.target.value) || 8)}
                />
              </Field>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button
                  variant="secondary"
                  onClick={() => setActiveProfileId(selected.id)}
                  disabled={activeProfileId === selected.id}
                >
                  Set as default
                </Button>
                <Button variant="danger" onClick={removeSelected}>
                  <Trash2 size={14} /> Remove
                </Button>
              </div>
            </div>
          </PanelCard>
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
        </>
      ) : null}

      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="primary" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="ghost" disabled={saving} onClick={() => void load()}>
          Discard
        </Button>
      </div>
    </div>
  );
}
