'use client';

import type { PublicMcpPreset } from '@/lib/constants';
import { PUBLIC_MCP_SERVERS } from '@/lib/constants';
import type { McpConnection } from '@/lib/models';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { PanelCard } from '@/components/ui/Panel';

type Props = {
  connections: McpConnection[];
  busy: boolean;
  mcpName: string;
  mcpTransport: 'stdio' | 'http';
  mcpCommand: string;
  mcpArgs: string;
  mcpUrl: string;
  githubToken: string;
  onName: (v: string) => void;
  onTransport: (v: 'stdio' | 'http') => void;
  onCommand: (v: string) => void;
  onArgs: (v: string) => void;
  onUrl: (v: string) => void;
  onGithubToken: (v: string) => void;
  onConnect: () => void;
  onDisconnect: (id: string) => void;
  onConnectPreset: (preset: PublicMcpPreset) => void;
};

export function McpServersPanel(props: Props) {
  const {
    connections,
    busy,
    mcpName,
    mcpTransport,
    mcpCommand,
    mcpArgs,
    mcpUrl,
    githubToken,
    onName,
    onTransport,
    onCommand,
    onArgs,
    onUrl,
    onGithubToken,
    onConnect,
    onDisconnect,
    onConnectPreset,
  } = props;

  return (
    <div className="pad scroll-y stack">
      <div className="grid-2">
        <PanelCard>
          <div className="stack">
            <strong>Connect server</strong>
            <Field label="Name">
              <Input value={mcpName} onChange={(e) => onName(e.target.value)} />
            </Field>
            <Field label="Transport">
              <Select
                value={mcpTransport}
                onChange={(e) => onTransport(e.target.value as 'stdio' | 'http')}
              >
                <option value="stdio">stdio</option>
                <option value="http">Streamable HTTP</option>
              </Select>
            </Field>
            {mcpTransport === 'stdio' ? (
              <>
                <Field label="Command">
                  <Input value={mcpCommand} onChange={(e) => onCommand(e.target.value)} />
                </Field>
                <Field label="Args">
                  <Input value={mcpArgs} onChange={(e) => onArgs(e.target.value)} />
                </Field>
              </>
            ) : (
              <Field label="URL">
                <Input value={mcpUrl} onChange={(e) => onUrl(e.target.value)} />
              </Field>
            )}
            <Button variant="primary" disabled={busy} onClick={onConnect}>
              Connect
            </Button>
          </div>
        </PanelCard>

        <PanelCard>
          <div className="stack">
            <strong>Live connections</strong>
            {connections.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                No MCP servers connected.
              </p>
            ) : (
              connections.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div>{c.name}</div>
                    <div className="dim mono" style={{ fontSize: 11 }}>
                      {c.transport}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Badge tone={c.status === 'connected' ? 'success' : 'error'}>{c.status}</Badge>
                    <Button variant="ghost" onClick={() => onDisconnect(c.id)}>
                      Disconnect
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </PanelCard>
      </div>

      <PanelCard>
        <div className="stack">
          <strong>Public presets</strong>
          <Field label="GitHub PAT (for GitHub presets)">
            <Input
              type="password"
              value={githubToken}
              onChange={(e) => onGithubToken(e.target.value)}
              placeholder="ghp_…"
            />
          </Field>
          <div className="grid-2">
            {PUBLIC_MCP_SERVERS.map((preset) => (
              <div
                key={preset.id}
                style={{
                  border: '1px solid var(--parity-border-subtle)',
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                <div style={{ fontWeight: 600 }}>{preset.name}</div>
                <p className="muted" style={{ margin: '6px 0 10px', fontSize: 12 }}>
                  {preset.description}
                </p>
                <Button variant="secondary" disabled={busy} onClick={() => onConnectPreset(preset)}>
                  Connect
                </Button>
              </div>
            ))}
          </div>
        </div>
      </PanelCard>
    </div>
  );
}
