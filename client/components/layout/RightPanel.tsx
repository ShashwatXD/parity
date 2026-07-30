'use client';

import {
  Activity,
  FolderTree,
  Globe,
  SquareTerminal,
  Wrench,
} from 'lucide-react';
import { RIGHT_PANEL_TABS } from '@/lib/constants';
import type { RightPanelTab } from '@/lib/models';
import { cn } from '@/lib/utils/cn';

const TAB_ICONS: Record<RightPanelTab, React.ReactNode> = {
  files: <FolderTree size={13} />,
  terminal: <SquareTerminal size={13} />,
  browser: <Globe size={13} />,
  tools: <Wrench size={13} />,
  timeline: <Activity size={13} />,
  details: <Activity size={13} />,
};

type Props = {
  tab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;
  children: React.ReactNode;
  embedded?: boolean;
};

export function RightPanel({ tab, onTabChange, children, embedded }: Props) {
  return (
    <aside className={cn('right-panel', embedded && 'right-panel-embedded')}>
      <div className="right-panel-tabs">
        {RIGHT_PANEL_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={cn('panel-tab', tab === t.id && 'active')}
            onClick={() => onTabChange(t.id)}
          >
            {TAB_ICONS[t.id]}
            <span className="panel-tab-label">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="right-panel-body">{children}</div>
    </aside>
  );
}

export function WorkspacePlaceholder({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="workspace-placeholder">
      <div className="icon-wrap">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
