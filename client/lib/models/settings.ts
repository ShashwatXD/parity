import type { ProviderId } from './common';

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

export type AppSettings = {
  defaultProvider: ProviderId;
  defaultModel: string;
  activeProfileId: string;
  workspaceRoot: string;
  systemPrompt: string;
  condensationPrompt: string;
  maxAgentSteps: number;
  disabledSkills: string[];
  embedding: {
    apiKeySet: boolean;
    apiKeyHint: string;
    baseUrl: string;
    model: string;
  };
  providers: Record<ProviderId, PublicProviderConfig>;
  profiles: PublicLlmProfile[];
};

export type LlmProfileDraft = {
  id: string;
  name: string;
  provider: ProviderId;
  model: string;
  apiKey?: string;
  baseUrl: string;
};

export type SettingsUpdate = {
  defaultProvider?: ProviderId | string;
  defaultModel?: string;
  activeProfileId?: string;
  workspaceRoot?: string;
  systemPrompt?: string;
  condensationPrompt?: string;
  maxAgentSteps?: number;
  disabledSkills?: string[];
  embedding?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
  providers?: Partial<
    Record<
      ProviderId,
      {
        apiKey?: string;
        baseUrl?: string;
        defaultModel?: string;
      }
    >
  >;
  profiles?: LlmProfileDraft[];
};

export type SkillInfo = {
  name: string;
  description: string;
  triggers: string[];
  body: string;
  enabled: boolean;
};
