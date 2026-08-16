export type ProviderId = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'custom';

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export type NavItemId =
  | 'chat'
  | 'sessions'
  | 'servers'
  | 'tools'
  | 'playground'
  | 'resources'
  | 'prompts'
  | 'workflows'
  | 'memory'
  | 'observability'
  | 'settings';

/** @deprecated Prefer NavItemId */
export type WorkspaceTab = NavItemId;

export type RightPanelTab =
  | 'files'
  | 'terminal'
  | 'browser'
  | 'tools'
  | 'timeline'
  | 'details';


export type ApiErrorBody = {
  error?: string;
};

export type HealthStatus = {
  ok: boolean;
  phases?: string[];
  [key: string]: unknown;
};
