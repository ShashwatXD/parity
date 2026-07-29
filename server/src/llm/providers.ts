import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { z } from 'zod';

export const providerSchema = z.enum(['openai', 'anthropic', 'gemini', 'ollama']);
export type ProviderId = z.infer<typeof providerSchema>;

export function getModel(provider: ProviderId, model: string): LanguageModel {
  switch (provider) {
    case 'openai': {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not set');
      }
      return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(model);
    }
    case 'anthropic': {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is not set');
      }
      return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(model);
    }
    case 'gemini': {
      if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.GEMINI_API_KEY) {
        throw new Error('GOOGLE_GENERATIVE_AI_API_KEY (or GEMINI_API_KEY) is not set');
      }
      return createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY,
      })(model);
    }
    case 'ollama': {
      const baseURL = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434/v1';
      // Must be a local tag from `ollama list` (e.g. qwen2.5:3b), not gpt-4o-mini.
      return createOpenAICompatible({
        name: 'ollama',
        baseURL,
        apiKey: process.env.OLLAMA_API_KEY ?? 'ollama',
      })(model);
    }
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unsupported provider: ${_exhaustive}`);
    }
  }
}
