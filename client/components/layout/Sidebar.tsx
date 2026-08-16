'use client';

import {
  Activity,
  Brain,
  ChevronLeft,
  ChevronRight,
  History,
  MessageSquare,
  Plus,
  Puzzle,
  Server,
  Settings,
  Trash2,
  Wrench,
  Workflow,
} from 'lucide-react';
import { PRIMARY_NAV, PRODUCT_MARK, PRODUCT_NAME, PRODUCT_TAGLINE } from '@/lib/constants';
import type { NavItemId, Session } from '@/lib/models';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';

const NAV_ICONS: Record<string, React.ReactNode> = {
  chat: <MessageSquare size={16} />,
  sessions: <History size={16} />,
  servers: <Server size={16} />,
  tools: <Wrench size={16} />,
  playground: <Puzzle size={16} />,
  workflows: <Workflow size={16} />,
  memory: <Brain size={16} />,
  observability: <Activity size={16} />,
  settings: <Settings size={16} />,
};

type Props = {
  active: NavItemId;
  collapsed: boolean;
  sessions: Session[];
  sessionId: string;
  connectionCount: number;
  onNavigate: (id: NavItemId) => void;
  onToggle: () => void;
  onNewChat: () => void;
  onOpenSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
};

export function Sidebar({
  active,
  collapsed,
  sessions,
  sessionId,
  connectionCount,
  onNavigate,
  onToggle,
  onNewChat,
  onOpenSession,
  onDeleteSession,
}: Props) {
  return (
    <aside className={cn('sidebar', collapsed && 'is-collapsed')}>
      <div className="sidebar-header" data-testid="app-brand">
        <span className="brand-mark">{PRODUCT_MARK}</span>
        <div className="brand-text sidebar-expanded-only">
          <span className="brand-name">{PRODUCT_NAME}</span>
          <span className="brand-tag">{PRODUCT_TAGLINE}</span>
        </div>
      </div>

      <div className="sidebar-section">
        <Button variant="primary" onClick={onNewChat} className="sidebar-new-btn" data-testid="new-chat">
          <Plus size={14} />
          <span className="sidebar-expanded-only">New conversation</span>
        </Button>
      </div>

      <div className="sidebar-recent">
        <div className="sidebar-section-label sidebar-expanded-only">Recent</div>
        <div className="sidebar-conversations">
          {sessions.map((s) => (
            <div key={s.id} className="session-row">
              <button
                type="button"
                className={cn('session-item', s.id === sessionId && active === 'chat' && 'active')}
                onClick={() => {
                  onOpenSession(s.id);
                  onNavigate('chat');
                }}
                title={s.title}
              >
                <MessageSquare size={14} />
                <span className="session-item-label sidebar-expanded-only">{s.title}</span>
              </button>
              <Button
                variant="ghost"
                icon
                className="sidebar-expanded-only session-delete"
                title="Delete"
                onClick={() => onDeleteSession(s.id)}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label sidebar-expanded-only">Workspace</div>
        {PRIMARY_NAV.filter((item) => item.id !== 'chat').map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn('nav-item', active === item.id && 'active')}
            onClick={() => onNavigate(item.id)}
            title={item.label}
            data-testid={`nav-${item.id}`}
          >
            {NAV_ICONS[item.id]}
            <span className="nav-item-label sidebar-expanded-only">{item.label}</span>
            {item.id === 'servers' && connectionCount > 0 ? (
              <span className="nav-item-meta sidebar-expanded-only">{connectionCount}</span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <Button variant="ghost" onClick={onToggle} className="sidebar-toggle-btn">
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          <span className="sidebar-expanded-only">Collapse</span>
        </Button>
      </div>
    </aside>
  );
}
