'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type Props = {
  sidebarCollapsed: boolean;
  sidebarOpenMobile: boolean;
  panelOpenMobile: boolean;
  showRightPanel: boolean;
  breakpoint: 'mobile' | 'tablet' | 'desktop';
  sidebar: ReactNode;
  children: ReactNode;
  rightPanel?: ReactNode;
  error?: string;
  onCloseSidebarMobile?: () => void;
  onClosePanelMobile?: () => void;
};

export function AppShell({
  sidebarCollapsed,
  sidebarOpenMobile,
  panelOpenMobile,
  showRightPanel,
  breakpoint,
  sidebar,
  children,
  rightPanel,
  error,
  onCloseSidebarMobile,
  onClosePanelMobile,
}: Props) {
  const isMobile = breakpoint === 'mobile';
  const isTablet = breakpoint === 'tablet';
  const overlaySidebar = isMobile && sidebarOpenMobile;
  const overlayPanel = (isMobile || isTablet) && panelOpenMobile && showRightPanel;

  return (
    <div
      className={cn(
        'app-shell',
        sidebarCollapsed && 'sidebar-collapsed',
        `bp-${breakpoint}`,
      )}
    >
      <div
        className={cn(
          'sidebar-slot',
          overlaySidebar && 'sidebar-slot-open',
          isMobile && 'sidebar-slot-mobile',
        )}
      >
        {sidebar}
      </div>

      {overlaySidebar ? (
        <button
          type="button"
          className="shell-backdrop"
          aria-label="Close sidebar"
          onClick={onCloseSidebarMobile}
        />
      ) : null}

      <div className="main-stage">
        {error ? <div className="error-banner">{error}</div> : null}
        <div className="stage-body">
          <div className="conversation-pane">{children}</div>

          {showRightPanel && breakpoint === 'desktop' ? rightPanel : null}
        </div>
      </div>

      {overlayPanel ? (
        <>
          <button
            type="button"
            className="shell-backdrop panel-backdrop"
            aria-label="Close workspace panel"
            onClick={onClosePanelMobile}
          />
          <div className="panel-drawer" role="dialog" aria-modal="true">
            <div className="panel-drawer-chrome">
              <span>Workspace</span>
              <button type="button" className="btn btn-ghost btn-icon" onClick={onClosePanelMobile}>
                ×
              </button>
            </div>
            {rightPanel}
          </div>
        </>
      ) : null}
    </div>
  );
}
