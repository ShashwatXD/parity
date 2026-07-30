'use client';

import type { DiscoveredPrompt, DiscoveredResource } from '@/lib/models';
import { EmptyState, PanelCard } from '@/components/ui/Panel';

export function ResourcesPanel({ resources }: { resources: DiscoveredResource[] }) {
  if (!resources.length) {
    return <EmptyState title="No resources" description="Connected servers have no resources." />;
  }
  return (
    <div className="pad scroll-y stack">
      {resources.map((r) => (
        <PanelCard key={`${r.connectionId}:${r.uri}`}>
          <div style={{ fontWeight: 600 }}>{r.name || r.uri}</div>
          <div className="dim mono" style={{ fontSize: 11 }}>{r.uri}</div>
          <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>
            {r.description || r.connectionName}
          </p>
        </PanelCard>
      ))}
    </div>
  );
}

export function PromptsPanel({ prompts }: { prompts: DiscoveredPrompt[] }) {
  if (!prompts.length) {
    return <EmptyState title="No prompts" description="Connected servers have no prompts." />;
  }
  return (
    <div className="pad scroll-y stack">
      {prompts.map((p) => (
        <PanelCard key={`${p.connectionId}:${p.name}`}>
          <div style={{ fontWeight: 600 }}>{p.name}</div>
          <div className="dim" style={{ fontSize: 12 }}>{p.connectionName}</div>
          <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>
            {p.description || 'No description'}
          </p>
        </PanelCard>
      ))}
    </div>
  );
}
