'use client';

import type { DiscoveredTool } from '@/lib/models';
import { EmptyState, PanelCard } from '@/components/ui/Panel';

export function ToolsPanel({ tools }: { tools: DiscoveredTool[] }) {
  if (!tools.length) {
    return (
      <EmptyState
        title="No tools yet"
        description="Connect an MCP server to discover tools."
      />
    );
  }

  return (
    <div className="pad scroll-y stack">
      {tools.map((t) => (
        <PanelCard key={`${t.connectionId}:${t.name}`}>
          <div style={{ fontWeight: 600 }}>{t.name}</div>
          <div className="dim mono" style={{ fontSize: 11, marginTop: 4 }}>
            {t.connectionName}
          </div>
          <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>
            {t.description || 'No description'}
          </p>
        </PanelCard>
      ))}
    </div>
  );
}
