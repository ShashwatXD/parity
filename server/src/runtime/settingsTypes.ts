import { z } from 'zod';
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from '../constants.js';
import type { ProviderId } from '../llm/providers.js';

export const DEFAULT_SYSTEM_PROMPT =
  'You are Parity, a coding agent with a real workspace sandbox and MCP tools. Prefer workspace tools (file_editor, terminal, grep, git_status, task_tracker) for code work; use MCP when connected servers help. Trust each MCP tool’s own name, description, and schema — do not invent tools or outcomes. Report tool results accurately. For multi-step tasks, write a short task_tracker plan first. Prefer the conversation summary (if present) plus recent turns as memory. Be concise and precise. Structure final answers as clear markdown when useful.';

export const DEFAULT_CONDENSATION_PROMPT =
  'You compress long agent chats into a durable memory brief. Preserve goals, decisions, file paths, tool outcomes, errors, and open todos. Omit chit-chat. Use tight markdown bullets.';

export const providerConfigSchema = z.object({
  apiKey: z.string().optional().default(''),
  baseUrl: z.string().optional().default(''),
  defaultModel: z.string().optional().default(''),
});

export const llmProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  provider: z.enum(['openai', 'anthropic', 'gemini', 'ollama', 'custom']),
  model: z.string().min(1),
  apiKey: z.string().optional().default(''),
  baseUrl: z.string().optional().default(''),
});

export const appSettingsSchema = z.object({
  defaultProvider: z
    .enum(['openai', 'anthropic', 'gemini', 'ollama', 'custom'])
    .default(DEFAULT_PROVIDER),
  defaultModel: z.string().default(DEFAULT_MODEL),
  activeProfileId: z.string().optional().default(''),
  workspaceRoot: z.string().optional().default(''),
  systemPrompt: z.string().default(DEFAULT_SYSTEM_PROMPT),
  condensationPrompt: z.string().default(DEFAULT_CONDENSATION_PROMPT),
  maxAgentSteps: z.number().int().min(1).max(64).default(16),
  providers: z
    .object({
      openai: providerConfigSchema.default({}),
      anthropic: providerConfigSchema.default({}),
      gemini: providerConfigSchema.default({}),
      ollama: providerConfigSchema.default({
        baseUrl: 'http://127.0.0.1:11434/v1',
        apiKey: 'ollama',
        defaultModel: DEFAULT_MODEL,
      }),
      custom: providerConfigSchema.default({
        baseUrl: '',
        apiKey: '',
        defaultModel: 'my-model',
      }),
    })
    .default({}),
  profiles: z.array(llmProfileSchema).default([]),
});

export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export type LlmProfile = z.infer<typeof llmProfileSchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;

export type PublicProviderConfig = {
  apiKeySet: boolean;
  apiKeyHint: string;
  baseUrl: string;
  defaultModel: string;
};

export type PublicLlmProfile = {
  id: string;
  name: string;
  provider: ProviderId;
  model: string;
  apiKeySet: boolean;
  apiKeyHint: string;
  baseUrl: string;
};

export type PublicAppSettings = {
  defaultProvider: ProviderId;
  defaultModel: string;
  activeProfileId: string;
  workspaceRoot: string;
  systemPrompt: string;
  condensationPrompt: string;
  maxAgentSteps: number;
  providers: Record<ProviderId, PublicProviderConfig>;
  profiles: PublicLlmProfile[];
};

function hintForKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 4) return '••••';
  return `••••${trimmed.slice(-4)}`;
}

function seedProfilesFromProviders(settings: AppSettings): LlmProfile[] {
  const profiles: LlmProfile[] = [];
  const ollama = settings.providers.ollama;
  profiles.push({
    id: 'profile_ollama_local',
    name: 'Ollama local',
    provider: 'ollama',
    model: ollama.defaultModel || settings.defaultModel || DEFAULT_MODEL,
    apiKey: ollama.apiKey || 'ollama',
    baseUrl: ollama.baseUrl || 'http://127.0.0.1:11434/v1',
  });
  if (settings.providers.openai.apiKey?.trim() || process.env.OPENAI_API_KEY) {
    profiles.push({
      id: 'profile_openai_default',
      name: 'OpenAI',
      provider: 'openai',
      model: settings.providers.openai.defaultModel || 'gpt-4o-mini',
      apiKey: settings.providers.openai.apiKey || process.env.OPENAI_API_KEY || '',
      baseUrl: settings.providers.openai.baseUrl || '',
    });
  }
  if (settings.providers.anthropic.apiKey?.trim() || process.env.ANTHROPIC_API_KEY) {
    profiles.push({
      id: 'profile_anthropic_default',
      name: 'Anthropic',
      provider: 'anthropic',
      model: settings.providers.anthropic.defaultModel || 'claude-3-5-haiku-latest',
      apiKey: settings.providers.anthropic.apiKey || process.env.ANTHROPIC_API_KEY || '',
      baseUrl: settings.providers.anthropic.baseUrl || '',
    });
  }
  if (
    settings.providers.gemini.apiKey?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_API_KEY
  ) {
    profiles.push({
      id: 'profile_gemini_default',
      name: 'Gemini',
      provider: 'gemini',
      model: settings.providers.gemini.defaultModel || 'gemini-2.0-flash',
      apiKey:
        settings.providers.gemini.apiKey ||
        process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
        process.env.GEMINI_API_KEY ||
        '',
      baseUrl: '',
    });
  }
  if (settings.providers.custom.baseUrl?.trim() || process.env.CUSTOM_LLM_BASE_URL) {
    profiles.push({
      id: 'profile_custom_default',
      name: 'Custom OpenAI-compatible',
      provider: 'custom',
      model:
        settings.providers.custom.defaultModel ||
        process.env.CUSTOM_LLM_MODEL ||
        'my-model',
      apiKey: settings.providers.custom.apiKey || process.env.CUSTOM_LLM_API_KEY || '',
      baseUrl: settings.providers.custom.baseUrl || process.env.CUSTOM_LLM_BASE_URL || '',
    });
  }
  return profiles;
}

export function ensureProfiles(settings: AppSettings): AppSettings {
  const next = structuredClone(settings);
  if (!next.profiles.length) {
    next.profiles = seedProfilesFromProviders(next);
  }
  if (!next.activeProfileId || !next.profiles.some((p) => p.id === next.activeProfileId)) {
    const preferred =
      next.profiles.find((p) => p.provider === next.defaultProvider) ?? next.profiles[0];
    next.activeProfileId = preferred?.id ?? '';
  }
  const active = next.profiles.find((p) => p.id === next.activeProfileId);
  if (active) {
    next.defaultProvider = active.provider;
    next.defaultModel = active.model;
  }
  return next;
}

export function defaultSettings(): AppSettings {
  const base = appSettingsSchema.parse({
    defaultProvider: DEFAULT_PROVIDER,
    defaultModel: DEFAULT_MODEL,
    activeProfileId: '',
    workspaceRoot: '',
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    condensationPrompt: DEFAULT_CONDENSATION_PROMPT,
    maxAgentSteps: 8,
    providers: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY ?? '',
        baseUrl: process.env.OPENAI_BASE_URL ?? '',
        defaultModel: 'gpt-4o-mini',
      },
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY ?? '',
        baseUrl: process.env.ANTHROPIC_BASE_URL ?? '',
        defaultModel: 'claude-3-5-haiku-latest',
      },
      gemini: {
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY ?? '',
        baseUrl: '',
        defaultModel: 'gemini-2.0-flash',
      },
      ollama: {
        apiKey: process.env.OLLAMA_API_KEY ?? 'ollama',
        baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434/v1',
        defaultModel: DEFAULT_MODEL,
      },
      custom: {
        apiKey: process.env.CUSTOM_LLM_API_KEY ?? '',
        baseUrl: process.env.CUSTOM_LLM_BASE_URL ?? '',
        defaultModel: process.env.CUSTOM_LLM_MODEL ?? 'my-model',
      },
    },
    profiles: [],
  });
  return ensureProfiles(base);
}

export function toPublicSettings(settings: AppSettings): PublicAppSettings {
  const ensured = ensureProfiles(settings);
  const map = (cfg: ProviderConfig): PublicProviderConfig => ({
    apiKeySet: Boolean(cfg.apiKey?.trim()),
    apiKeyHint: hintForKey(cfg.apiKey ?? ''),
    baseUrl: cfg.baseUrl ?? '',
    defaultModel: cfg.defaultModel ?? '',
  });

  return {
    defaultProvider: ensured.defaultProvider,
    defaultModel: ensured.defaultModel,
    activeProfileId: ensured.activeProfileId ?? '',
    workspaceRoot: ensured.workspaceRoot ?? '',
    systemPrompt: ensured.systemPrompt,
    condensationPrompt: ensured.condensationPrompt,
    maxAgentSteps: ensured.maxAgentSteps,
    providers: {
      openai: map(ensured.providers.openai),
      anthropic: map(ensured.providers.anthropic),
      gemini: map(ensured.providers.gemini),
      ollama: map(ensured.providers.ollama),
      custom: map(ensured.providers.custom),
    },
    profiles: ensured.profiles.map((p) => ({
      id: p.id,
      name: p.name,
      provider: p.provider,
      model: p.model,
      apiKeySet: Boolean(p.apiKey?.trim()),
      apiKeyHint: hintForKey(p.apiKey ?? ''),
      baseUrl: p.baseUrl ?? '',
    })),
  };
}

export function resolveProfile(
  settings: AppSettings,
  profileId?: string,
): LlmProfile | undefined {
  const ensured = ensureProfiles(settings);
  if (profileId) {
    return ensured.profiles.find((p) => p.id === profileId);
  }
  return ensured.profiles.find((p) => p.id === ensured.activeProfileId) ?? ensured.profiles[0];
}

/** Merge PATCH body; empty apiKey string means "leave unchanged". */
export function mergeSettingsPatch(
  current: AppSettings,
  patch: Record<string, unknown>,
): AppSettings {
  const next = structuredClone(ensureProfiles(current));

  if (typeof patch.defaultProvider === 'string') {
    next.defaultProvider = patch.defaultProvider as ProviderId;
  }
  if (typeof patch.defaultModel === 'string') next.defaultModel = patch.defaultModel;
  if (typeof patch.activeProfileId === 'string') next.activeProfileId = patch.activeProfileId;
  if (typeof patch.workspaceRoot === 'string') next.workspaceRoot = patch.workspaceRoot;
  if (typeof patch.systemPrompt === 'string') next.systemPrompt = patch.systemPrompt;
  if (typeof patch.condensationPrompt === 'string') {
    next.condensationPrompt = patch.condensationPrompt;
  }
  if (typeof patch.maxAgentSteps === 'number') next.maxAgentSteps = patch.maxAgentSteps;

  const providers = patch.providers as Record<string, Record<string, unknown>> | undefined;
  if (providers && typeof providers === 'object') {
    for (const id of ['openai', 'anthropic', 'gemini', 'ollama', 'custom'] as const) {
      const p = providers[id];
      if (!p || typeof p !== 'object') continue;
      if (typeof p.baseUrl === 'string') next.providers[id].baseUrl = p.baseUrl;
      if (typeof p.defaultModel === 'string') next.providers[id].defaultModel = p.defaultModel;
      if (typeof p.apiKey === 'string' && p.apiKey.trim().length > 0) {
        next.providers[id].apiKey = p.apiKey;
      }
    }
  }

  if (Array.isArray(patch.profiles)) {
    const incoming = patch.profiles as Array<Record<string, unknown>>;
    const byId = new Map(next.profiles.map((p) => [p.id, p]));
    const merged: LlmProfile[] = [];

    for (const raw of incoming) {
      const id = String(raw.id ?? '');
      const existing = id ? byId.get(id) : undefined;
      const apiKeyRaw = typeof raw.apiKey === 'string' ? raw.apiKey : '';
      const profile = llmProfileSchema.parse({
        id: id || `profile_${crypto.randomUUID()}`,
        name: String(raw.name ?? existing?.name ?? 'Untitled'),
        provider: String(raw.provider ?? existing?.provider ?? 'ollama'),
        model: String(raw.model ?? existing?.model ?? DEFAULT_MODEL),
        apiKey: apiKeyRaw.trim() ? apiKeyRaw : (existing?.apiKey ?? ''),
        baseUrl: typeof raw.baseUrl === 'string' ? raw.baseUrl : (existing?.baseUrl ?? ''),
      });
      merged.push(profile);
    }
    next.profiles = merged;
  }

  return appSettingsSchema.parse(ensureProfiles(next));
}
