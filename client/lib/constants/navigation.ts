import type { NavItemId, RightPanelTab } from '../models';

export type NavItem = {
  id: NavItemId;
  label: string;
  hint: string;
};

export const PRIMARY_NAV: NavItem[] = [
  { id: 'chat', label: 'Conversations', hint: 'Agent' },
  { id: 'servers', label: 'MCP', hint: 'Servers' },
  { id: 'tools', label: 'Tools', hint: 'Registry' },
  { id: 'playground', label: 'Playground', hint: 'Invoke' },
  { id: 'workflows', label: 'Automations', hint: 'Workflows' },
  { id: 'observability', label: 'Observability', hint: 'Timeline' },
  { id: 'settings', label: 'Settings', hint: 'LLM & prompts' },
];

/** @deprecated Prefer PRIMARY_NAV */
export const NAV_ITEMS: NavItem[] = [
  ...PRIMARY_NAV,
  { id: 'resources', label: 'Resources', hint: 'MCP resources' },
  { id: 'prompts', label: 'Prompts', hint: 'MCP prompts' },
];

export const RIGHT_PANEL_TABS: { id: RightPanelTab; label: string }[] = [
  { id: 'files', label: 'Files' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'browser', label: 'Browser' },
  { id: 'tools', label: 'Tools' },
  { id: 'timeline', label: 'Timeline' },
];

export const SIDEBAR_WIDTH_EXPANDED = 260;
export const SIDEBAR_WIDTH_COLLAPSED = 56;
export const RIGHT_PANEL_DEFAULT_RATIO = 0.45;
