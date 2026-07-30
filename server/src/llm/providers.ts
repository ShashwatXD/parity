import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { z } from 'zod';
import { getSettings } from '../runtime/settings.js';
import { resolveProfile, type LlmProfile } from '../runtime/settingsTypes.js';

export const providerSchema = z.enum(['openai', 'anthropic', 'gemini', 'ollama', 'custom']);
export type ProviderId = z.infer<typeof providerSchema>;

export type ModelCredentials = {
  apiKey?: string;
  baseUrl?: string;
};

export function credentialsForProfile(profile?: LlmProfile): ModelCredentials {
  if (!profile) return {};
  const settings = getSettings();
  const shared = settings.providers[profile.provider];
  return {
    apiKey: profile.apiKey?.trim() || shared.apiKey?.trim() || undefined,
    baseUrl: profile.baseUrl?.trim() || shared.baseUrl?.trim() || undefined,
  };
}

export function getModel(
  provider: ProviderId,
  model: string,
  credentials?: ModelCredentials,
): LanguageModel {
  const settings = getSettings();
  const cfg = settings.providers[provider];
  const apiKey = credentials?.apiKey?.trim() || cfg.apiKey?.trim();
  const baseUrl = credentials?.baseUrl?.trim() || cfg.baseUrl?.trim();

  switch (provider) {
    case 'openai': {
      const key = apiKey || process.env.OPENAI_API_KEY;
      if (!key) throw new Error('OpenAI API key is not set — add it on an LLM profile in Settings');
      return createOpenAI({
        apiKey: key,
        ...(baseUrl || process.env.OPENAI_BASE_URL
          ? { baseURL: baseUrl || process.env.OPENAI_BASE_URL }
          : {}),
      })(model);
    }
    case 'anthropic': {
      const key = apiKey || process.env.ANTHROPIC_API_KEY;
      if (!key) throw new Error('Anthropic API key is not set — add it on an LLM profile in Settings');
      return createAnthropic({
        apiKey: key,
        ...(baseUrl || process.env.ANTHROPIC_BASE_URL
          ? { baseURL: baseUrl || process.env.ANTHROPIC_BASE_URL }
          : {}),
      })(model);
    }
    case 'gemini': {
      const key =
        apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
      if (!key) throw new Error('Gemini API key is not set — add it on an LLM profile in Settings');
      return createGoogleGenerativeAI({ apiKey: key })(model);
    }
    case 'ollama': {
      const url = baseUrl || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1';
      return createOpenAICompatible({
        name: 'ollama',
        baseURL: url,
        apiKey: apiKey || process.env.OLLAMA_API_KEY || 'ollama',
      })(model);
    }
    case 'custom': {
      const url = baseUrl || process.env.CUSTOM_LLM_BASE_URL;
      if (!url) {
        throw new Error('Custom LLM base URL is required — set it on the profile in Settings');
      }
      const key = apiKey || process.env.CUSTOM_LLM_API_KEY || 'custom';
      return createOpenAICompatible({
        name: 'custom',
        baseURL: url,
        apiKey: key,
      })(model);
    }
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unsupported provider: ${_exhaustive}`);
    }
  }
}

export function getModelForProfile(profileId?: string): {
  model: LanguageModel;
  provider: ProviderId;
  modelId: string;
  profile?: LlmProfile;
} {
  const settings = getSettings();
  const profile = resolveProfile(settings, profileId);
  if (!profile) {
    throw new Error('No LLM profile configured — add one in Settings');
  }
  return {
    model: getModel(profile.provider, profile.model, credentialsForProfile(profile)),
    provider: profile.provider,
    modelId: profile.model,
    profile,
  };
}
