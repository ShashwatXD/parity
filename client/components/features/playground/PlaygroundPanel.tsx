'use client';

import type { DiscoveredTool } from '@/lib/models';
import { Button } from '@/components/ui/Button';
import { Field, Select, Textarea } from '@/components/ui/Field';
import { EmptyState, PanelCard } from '@/components/ui/Panel';

type Props = {
  tools: DiscoveredTool[];
  playTool: string;
  playArgs: string;
  playResult: string;
  busy: boolean;
  onPlayTool: (v: string) => void;
  onPlayArgs: (v: string) => void;
  onRun: () => void;
};

export function PlaygroundPanel({
  tools,
  playTool,
  playArgs,
  playResult,
  busy,
  onPlayTool,
  onPlayArgs,
  onRun,
}: Props) {
  if (!tools.length) {
    return <EmptyState title="Playground" description="Connect tools before invoking." />;
  }

  return (
    <div className="pad scroll-y">
      <PanelCard>
        <div className="stack">
          <Field label="Tool">
            <Select value={playTool} onChange={(e) => onPlayTool(e.target.value)}>
              {tools.map((t) => {
                const id = `${t.connectionId}:${t.name}`;
                return (
                  <option key={id} value={id}>
                    {t.connectionName} / {t.name}
                  </option>
                );
              })}
            </Select>
          </Field>
          <Field label="Arguments (JSON)">
            <Textarea value={playArgs} onChange={(e) => onPlayArgs(e.target.value)} />
          </Field>
          <Button variant="primary" disabled={busy} onClick={onRun}>
            Call tool
          </Button>
          {playResult ? (
            <pre className="mono" style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>
              {playResult}
            </pre>
          ) : null}
        </div>
      </PanelCard>
    </div>
  );
}
