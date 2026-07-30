'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { settingsRepository, workspaceRepository } from '@/lib/api';
import { PROVIDER_OPTIONS } from '@/lib/constants';
import type {
  AppSettings,
  LlmProfileDraft,
  ProviderId,
  PublicLlmProfile,
  SettingsUpdate,
  SkillInfo,
} from '@/lib/models';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { PanelCard } from '@/components/ui/Panel';
import { cn } from '@/lib/utils/cn';

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
  const [section, setSection] = useState<'llms' | 'prompts' | 'workspace' | 'skills'>('llms');
  const [llmView, setLlmView] = useState<LlmView>('list');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [condensationPrompt, setCondensationPrompt] = useState('');
  const [maxAgentSteps, setMaxAgentSteps] = useState(16);
  const [workspaceRoot, setWorkspaceRoot] = useState('');
  const [embedApiKey, setEmbedApiKey] = useState('');
  const [embedBaseUrl, setEmbedBaseUrl] = useState('https://api.voyageai.com/v1');
  const [embedModel, setEmbedModel] = useState('voyage-code-3');
  const [embedHint, setEmbedHint] = useState<{ set: boolean; hint: string }>({
    set: false,
    hint: '',
  });
  const [disabledSkills, setDisabledSkills] = useState<string[]>([]);
  const [skillInfos, setSkillInfos] = useState<SkillInfo[]>([]);
  const [expandedSkill, setExpandedSkill] = useState('');
  const [skillView, setSkillView] = useState<'list' | 'create'>('list');
  const [skillName, setSkillName] = useState('');
  const [skillDescription, setSkillDescription] = useState('');
  const [skillTriggers, setSkillTriggers] = useState('');
  const [skillBody, setSkillBody] = useState('');
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
      setDisabledSkills(s.disabledSkills ?? []);
      setEmbedBaseUrl(s.embedding?.baseUrl || 'https://api.voyageai.com/v1');
      setEmbedModel(s.embedding?.model || 'voyage-code-3');
      setEmbedApiKey('');
      setEmbedHint({
        set: Boolean(s.embedding?.apiKeySet),
        hint: s.embedding?.apiKeyHint || '',
      });
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
      try {
        setSkillInfos(await workspaceRepository.skills());
      } catch {
        setSkillInfos([]);
      }
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
        disabledSkills,
        embedding: {
          baseUrl: embedBaseUrl,
          model: embedModel,
          ...(embedApiKey.trim() ? { apiKey: embedApiKey.trim() } : {}),
        },
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

  async function toggleSkill(name: string, enabled: boolean) {
    const nextDisabled = enabled
      ? disabledSkills.filter((n) => n !== name)
      : [...new Set([...disabledSkills, name])];
    setDisabledSkills(nextDisabled);
    setSkillInfos((prev) =>
      prev.map((s) => (s.name === name ? { ...s, enabled } : s)),
    );
    setSaving(true);
    setError('');
    setOk('');
    try {
      const saved = await settingsRepository.update({ disabledSkills: nextDisabled });
      onSaved?.(saved);
      setOk(enabled ? `Enabled ${name}` : `Disabled ${name}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDisabledSkills(disabledSkills);
      setSkillInfos((prev) =>
        prev.map((s) => (s.name === name ? { ...s, enabled: !enabled } : s)),
      );
    } finally {
      setSaving(false);
    }
  }

  function openCreateSkill() {
    setSkillView('create');
    setSkillName('');
    setSkillDescription('');
    setSkillTriggers('');
    setSkillBody(
      '1. Clarify the goal.\n2. Use the right tools.\n3. Verify with a command or read-back.\n',
    );
    setOk('');
    setError('');
  }

  async function createSkill() {
    setSaving(true);
    setError('');
    setOk('');
    try {
      await workspaceRepository.create({
        name: skillName,
        description: skillDescription,
        triggers: skillTriggers
          .split(/[,|]/)
          .map((t) => t.trim())
          .filter(Boolean),
        body: skillBody,
      });
      setOk('Skill created');
      setSkillView('list');
      setSkillInfos(await workspaceRepository.skills());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function removeSkill(name: string) {
    if (!window.confirm(`Delete skill “${name}”?`)) return;
    setSaving(true);
    setError('');
    try {
      await workspaceRepository.remove(name);
      setSkillInfos(await workspaceRepository.skills());
      setOk(`Deleted ${name}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="pad muted">Loading settings…</div>;

  const copy = draft ? PROVIDER_COPY[draft.provider] : PROVIDER_COPY.ollama;
  const hint = draft ? hints[draft.id] : undefined;
  const editingInDetail =
    (section === 'llms' && (llmView === 'create' || llmView === 'edit')) ||
    (section === 'skills' && skillView === 'create');

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
            className={section === 'skills' ? 'settings-tab active' : 'settings-tab'}
            onClick={() => {
              setSection('skills');
              setSkillView('list');
            }}
          >
            Skills
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

      {section === 'skills' && skillView === 'list' ? (
        <PanelCard>
          <div className="stack">
            <div className="llm-list-header">
              <div>
                <strong>Agent skills</strong>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
                  Conditional playbooks injected when triggers match. Stored as markdown in{' '}
                  <span className="mono">server/skills/</span>.
                </p>
              </div>
              <Button variant="secondary" onClick={openCreateSkill}>
                <Plus size={14} /> Add skill
              </Button>
            </div>
            {skillInfos.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                No skills yet. Add one to teach the agent a playbook.
              </p>
            ) : (
              <div className="skill-list">
                {skillInfos.map((skill) => {
                  const open = expandedSkill === skill.name;
                  return (
                    <div
                      key={skill.name}
                      className={cn('skill-row', !skill.enabled && 'skill-row-off')}
                    >
                      <div className="skill-row-top">
                        <button
                          type="button"
                          className="skill-row-main"
                          onClick={() =>
                            setExpandedSkill((n) => (n === skill.name ? '' : skill.name))
                          }
                        >
                          <span className="skill-row-name">{skill.name}</span>
                          <span className="skill-row-desc">{skill.description}</span>
                          {skill.triggers.length ? (
                            <span className="skill-triggers">
                              {skill.triggers.map((t) => (
                                <span key={t} className="skill-trigger">
                                  {t}
                                </span>
                              ))}
                            </span>
                          ) : (
                            <span className="skill-triggers muted">Always on when enabled</span>
                          )}
                        </button>
                        <label className="skill-toggle">
                          <input
                            type="checkbox"
                            checked={skill.enabled}
                            disabled={saving}
                            onChange={(e) => void toggleSkill(skill.name, e.target.checked)}
                          />
                          <span>{skill.enabled ? 'On' : 'Off'}</span>
                        </label>
                      </div>
                      {open ? (
                        <div className="stack" style={{ marginTop: 8 }}>
                          <pre className="skill-body">{skill.body}</pre>
                          <Button
                            variant="danger"
                            disabled={saving}
                            onClick={() => void removeSkill(skill.name)}
                          >
                            <Trash2 size={14} /> Delete
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </PanelCard>
      ) : null}

      {section === 'skills' && skillView === 'create' ? (
        <PanelCard>
          <div className="stack">
            <div className="llm-detail-nav">
              <button type="button" className="llm-back" onClick={() => setSkillView('list')}>
                <ArrowLeft size={14} /> Back
              </button>
              <strong>Add skill</strong>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              Name becomes the filename. Triggers are comma-separated keywords matched against the
              user message.
            </p>
            <Field label="Name">
              <Input
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                placeholder="pr-review"
                spellCheck={false}
              />
            </Field>
            <Field label="Description">
              <Input
                value={skillDescription}
                onChange={(e) => setSkillDescription(e.target.value)}
                placeholder="How to review pull requests"
              />
            </Field>
            <Field label="Triggers">
              <Input
                value={skillTriggers}
                onChange={(e) => setSkillTriggers(e.target.value)}
                placeholder="pr, review, pull request"
              />
            </Field>
            <Field label="Playbook body">
              <Textarea
                value={skillBody}
                onChange={(e) => setSkillBody(e.target.value)}
                style={{ minHeight: 160, fontFamily: 'var(--parity-mono)', fontSize: 12 }}
              />
            </Field>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                variant="primary"
                disabled={saving || !skillName.trim() || !skillBody.trim()}
                onClick={() => void createSkill()}
              >
                {saving ? 'Saving…' : 'Create skill'}
              </Button>
              <Button variant="ghost" disabled={saving} onClick={() => setSkillView('list')}>
                Cancel
              </Button>
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
          <PanelCard>
            <div className="stack">
              <strong>RAG embeddings</strong>
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                Separate from chat LLMs (works with any profile). Default is Voyage{' '}
                <span className="mono">voyage-code-3</span> — code-specialized, same class of
                embedder coding agents use for semantic search. OpenHands Canvas itself does not
                ship built-in codebase RAG; we follow that LLM-agnostic embedder pattern.
              </p>
              <Field label="Embedding model">
                <Input
                  value={embedModel}
                  onChange={(e) => setEmbedModel(e.target.value)}
                  placeholder="voyage-code-3"
                  spellCheck={false}
                />
              </Field>
              <Field label="Base URL">
                <Input
                  value={embedBaseUrl}
                  onChange={(e) => setEmbedBaseUrl(e.target.value)}
                  placeholder="https://api.voyageai.com/v1"
                  spellCheck={false}
                />
              </Field>
              <Field label="API key">
                <Input
                  type="password"
                  value={embedApiKey}
                  onChange={(e) => setEmbedApiKey(e.target.value)}
                  placeholder={
                    embedHint.set
                      ? `Stored ${embedHint.hint} — enter to replace`
                      : 'VOYAGE_API_KEY / EMBEDDING_API_KEY'
                  }
                  autoComplete="off"
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
