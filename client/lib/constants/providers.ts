import type { ProviderId } from '../models';

export const DEFAULT_PROVIDER: ProviderId = 'ollama';

export const DEFAULT_MODELS: Record<ProviderId, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-latest',
  gemini: 'gemini-2.0-flash',
  ollama: 'qwen2.5:3b',
  custom: 'my-model',
};

export const PROVIDER_OPTIONS: { id: ProviderId; label: string }[] = [
  { id: 'ollama', label: 'Ollama' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'custom', label: 'Custom' },
];
