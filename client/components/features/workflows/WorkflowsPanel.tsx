'use client';

import type { Approval, Artifact, BackgroundJob, Workflow } from '@/lib/models';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { PanelCard } from '@/components/ui/Panel';

type Props = {
  workflows: Workflow[];
  approvals: Approval[];
  artifacts: Artifact[];
  jobs: BackgroundJob[];
  wfName: string;
  busy: boolean;
  onWfName: (v: string) => void;
  onCreateDemo: () => void;
  onRun: (id: string, background?: boolean) => void;
  onResolve: (id: string, status: 'approved' | 'rejected') => void;
};

export function WorkflowsPanel({
  workflows,
  approvals,
  artifacts,
  jobs,
  wfName,
  busy,
  onWfName,
  onCreateDemo,
  onRun,
  onResolve,
}: Props) {
  return (
    <div className="pad scroll-y stack">
      <PanelCard>
        <div className="stack">
          <strong>Create demo workflow</strong>
          <Field label="Name">
            <Input value={wfName} onChange={(e) => onWfName(e.target.value)} />
          </Field>
          <Button variant="primary" disabled={busy} onClick={onCreateDemo}>
            Create from selected playground tool
          </Button>
        </div>
      </PanelCard>

      <PanelCard>
        <div className="stack">
          <strong>Workflows</strong>
          {workflows.map((w) => (
            <div key={w.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div>{w.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>{w.description}</div>
              </div>
              <Button disabled={busy} onClick={() => onRun(w.id, false)}>
                Run
              </Button>
              <Button disabled={busy} onClick={() => onRun(w.id, true)}>
                Background
              </Button>
            </div>
          ))}
        </div>
      </PanelCard>

      <div className="grid-2">
        <PanelCard>
          <div className="stack">
            <strong>Pending approvals</strong>
            {approvals.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>None</p>
            ) : (
              approvals.map((a) => (
                <div key={a.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ flex: 1 }}>{a.toolName}</span>
                  <Button variant="primary" onClick={() => onResolve(a.id, 'approved')}>
                    Approve
                  </Button>
                  <Button variant="danger" onClick={() => onResolve(a.id, 'rejected')}>
                    Reject
                  </Button>
                </div>
              ))
            )}
          </div>
        </PanelCard>
        <PanelCard>
          <div className="stack">
            <strong>Artifacts / jobs</strong>
            {artifacts.map((a) => (
              <div key={a.id}>
                {a.title} <Badge>{a.kind}</Badge>
              </div>
            ))}
            {jobs.map((j, i) => (
              <div key={String(j.id ?? i)} className="mono" style={{ fontSize: 12 }}>
                {String(j.kind ?? 'job')} · {String(j.status ?? '')}
              </div>
            ))}
          </div>
        </PanelCard>
      </div>
    </div>
  );
}
