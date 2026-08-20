'use client';

import type { AgentDef, AgentToolAccess, TeamState } from '@/lib/models';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { PanelCard } from '@/components/ui/Panel';

type Draft = {
  name: string;
  description: string;
  systemPrompt: string;
  tools: AgentToolAccess;
  maxSteps: number;
};

type Props = {
  agents: AgentDef[];
  teams: TeamState[];
  draft: Draft;
  teamTask: string;
  busy: boolean;
  lastSynthesis?: string;
  onDraft: (patch: Partial<Draft>) => void;
  onTeamTask: (v: string) => void;
  onCreateAgent: () => void;
  onDeleteAgent: (id: string) => void;
  onRunTeam: () => void;
  onCreateTeamWorkflow: () => void;
};

export function AgentsPanel({
  agents,
  teams,
  draft,
  teamTask,
  busy,
  lastSynthesis,
  onDraft,
  onTeamTask,
  onCreateAgent,
  onDeleteAgent,
  onRunTeam,
  onCreateTeamWorkflow,
}: Props) {
  return (
    <div className="pad scroll-y stack">
      <PanelCard>
        <div className="stack">
          <strong>Run multi-agent team</strong>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Director plans → workers run in parallel → synthesizer merges. Also available in chat via{' '}
            <code>run_team</code>.
          </p>
          <Field label="Task">
            <Textarea
              rows={3}
              value={teamTask}
              onChange={(e) => onTeamTask(e.target.value)}
              placeholder="e.g. Review auth flow and propose a safer session design"
            />
          </Field>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="primary" disabled={busy || !teamTask.trim()} onClick={onRunTeam}>
              Run team
            </Button>
            <Button disabled={busy} onClick={onCreateTeamWorkflow}>
              Save as team workflow
            </Button>
          </div>
          {lastSynthesis ? (
            <pre
              className="mono"
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                fontSize: 12,
                maxHeight: 220,
                overflow: 'auto',
              }}
            >
              {lastSynthesis}
            </pre>
          ) : null}
        </div>
      </PanelCard>

      <div className="grid-2">
        <PanelCard>
          <div className="stack">
            <strong>Agent roster</strong>
            {agents.map((a) => (
              <div
                key={a.id}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                  borderTop: '1px solid var(--border, #3333)',
                  paddingTop: 8,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <strong>{a.name}</strong>
                    <Badge>{a.tools}</Badge>
                    <Badge>{a.maxSteps} steps</Badge>
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {a.description || 'No description'}
                  </div>
                </div>
                <Button variant="danger" disabled={busy} onClick={() => onDeleteAgent(a.id)}>
                  Delete
                </Button>
              </div>
            ))}
          </div>
        </PanelCard>

        <PanelCard>
          <div className="stack">
            <strong>Add agent</strong>
            <Field label="Name">
              <Input value={draft.name} onChange={(e) => onDraft({ name: e.target.value })} />
            </Field>
            <Field label="Description">
              <Input
                value={draft.description}
                onChange={(e) => onDraft({ description: e.target.value })}
              />
            </Field>
            <Field label="System prompt">
              <Textarea
                rows={4}
                value={draft.systemPrompt}
                onChange={(e) => onDraft({ systemPrompt: e.target.value })}
              />
            </Field>
            <Field label="Tools">
              <select
                value={draft.tools}
                onChange={(e) => onDraft({ tools: e.target.value as AgentToolAccess })}
              >
                <option value="none">none</option>
                <option value="workspace">workspace</option>
                <option value="mcp">mcp</option>
                <option value="all">all</option>
              </select>
            </Field>
            <Field label="Max steps">
              <Input
                type="number"
                min={1}
                max={24}
                value={draft.maxSteps}
                onChange={(e) => onDraft({ maxSteps: Number(e.target.value) || 8 })}
              />
            </Field>
            <Button
              variant="primary"
              disabled={busy || !draft.name.trim() || !draft.systemPrompt.trim()}
              onClick={onCreateAgent}
            >
              Create agent
            </Button>
          </div>
        </PanelCard>
      </div>

      <PanelCard>
        <div className="stack">
          <strong>Recent team runs</strong>
          {teams.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              None yet
            </p>
          ) : (
            teams.slice(0, 12).map((s) => (
              <div key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>{s.task.slice(0, 120)}</div>
                  <div className="muted" style={{ fontSize: 11 }}>
                    {s.id} · loop {s.loop}/{s.maxLoops}
                    {s.directorPlan ? ` · ${s.directorPlan.slice(0, 80)}` : ''}
                  </div>
                </div>
                <Badge>{s.status}</Badge>
              </div>
            ))
          )}
        </div>
      </PanelCard>
    </div>
  );
}
