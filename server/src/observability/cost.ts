/** Rough public list prices ($ / 1M tokens). Used for interview-visible cost metrics. */
const RATES: Record<string, { input: number; output: number }> = {
  'openai:gpt-4o-mini': { input: 0.15, output: 0.6 },
  'openai:gpt-4o': { input: 2.5, output: 10 },
  'anthropic:claude-3-5-haiku-latest': { input: 0.8, output: 4 },
  'anthropic:claude-3-5-sonnet-latest': { input: 3, output: 15 },
  'gemini:gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'ollama:default': { input: 0, output: 0 },
};

export function estimateCostUsd(input: {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}): number {
  const key = `${input.provider}:${input.model}`;
  const rates =
    RATES[key] ??
    (input.provider === 'ollama'
      ? RATES['ollama:default']
      : { input: 0.5, output: 1.5 });
  const cost =
    (input.promptTokens / 1_000_000) * rates.input +
    (input.completionTokens / 1_000_000) * rates.output;
  return Number(cost.toFixed(8));
}
