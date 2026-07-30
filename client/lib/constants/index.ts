export * from './api';
export * from './mcpPresets';
export * from './navigation';
export * from './product';
export * from './providers';

/** @deprecated Use NAV_ITEMS — kept for gradual migration */
export const WORKSPACE_TABS = [
  'chat',
  'servers',
  'tools',
  'playground',
  'resources',
  'prompts',
  'workflows',
  'observability',
] as const;
