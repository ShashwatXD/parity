'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ApprovalApi,
  ChatApi,
  McpApi,
  ObservabilityApi,
  SessionApi,
  StudioApi,
  WorkflowApi,
} from '../lib/api/apiRepositories';
import { DEFAULT_MCP, DEFAULT_MODELS, DEFAULT_PROVIDER, PUBLIC_MCP_SERVERS, WORKSPACE_TABS } from '../lib/constants';
import type {
  Approval,
  Artifact,
  BackgroundJob,
  DiscoveredPrompt,
  DiscoveredResource,
  DiscoveredTool,
  ExecutionEvent,
  McpConnection,
  Message,
  MetricsSummary,
  PluginInfo,
  SearchResult,
  Session,
  Workflow,
  WorkspaceTab,
} from '../lib/models';

export default function HomePage() {
  const [tab, setTab] = useState<WorkspaceTab>('chat');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [connections, setConnections] = useState<McpConnection[]>([]);
  const [tools, setTools] = useState<DiscoveredTool[]>([]);
  const [resources, setResources] = useState<DiscoveredResource[]>([]);
  const [prompts, setPrompts] = useState<DiscoveredPrompt[]>([]);
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [metrics, setMetrics] = useState<Partial<MetricsSummary>>({});
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [search, setSearch] = useState('');
  const [searchHit, setSearchHit] = useState<SearchResult | null>(null);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState<string>(DEFAULT_PROVIDER);
  const [model, setModel] = useState<string>(DEFAULT_MODELS.ollama);
  const [mcpName, setMcpName] = useState(DEFAULT_MCP.name);
  const [mcpTransport, setMcpTransport] = useState<'stdio' | 'http'>(DEFAULT_MCP.transport);
  const [mcpCommand, setMcpCommand] = useState(DEFAULT_MCP.command);
  const [mcpArgs, setMcpArgs] = useState(DEFAULT_MCP.args);
  const [mcpUrl, setMcpUrl] = useState(DEFAULT_MCP.url);
  const [playTool, setPlayTool] = useState('');
  const [playArgs, setPlayArgs] = useState('{}');
  const [playResult, setPlayResult] = useState('');
  const [wfName, setWfName] = useState('Demo filesystem list');
  const [lastRunId, setLastRunId] = useState('');
  const [githubToken, setGithubToken] = useState('');

  const selectedTool = useMemo(
    () => tools.find((t) => `${t.connectionId}:${t.name}` === playTool) ?? tools[0],
    [tools, playTool],
  );

  async function refresh() {
    const [s, c, t, r, p, e, m, w, a, art, j, pl] = await Promise.all([
      SessionApi.list(),
      McpApi.connections(),
      McpApi.tools(),
      McpApi.resources(),
      McpApi.prompts(),
      ObservabilityApi.events(),
      ObservabilityApi.metrics(),
      WorkflowApi.list(),
      ApprovalApi.listPending(),
      StudioApi.artifacts(),
      StudioApi.jobs(),
      StudioApi.plugins(),
    ]);
    setSessions(s);
    setConnections(c.live ?? []);
    setTools(t);
    setResources(r);
    setPrompts(p);
    setEvents(e);
    setMetrics(m);
    setWorkflows(w);
    setApprovals(a);
    setArtifacts(art);
    setJobs(j);
    setPlugins(pl);
    if (!sessionId && s[0]) await openSession(s[0].id);
  }

  async function openSession(id: string) {
    setSessionId(id);
    const data = await SessionApi.get(id);
    setMessages(data.messages ?? []);
    setProvider(data.provider || DEFAULT_PROVIDER);
    setModel(data.model ?? DEFAULT_MODELS.ollama);
  }

  async function createChat() {
    const session = await SessionApi.create({ provider, model, title: 'New chat' });
    await refresh();
    await openSession(session.id);
  }

  async function deleteChat(id: string) {
    setError('');
    try {
      await SessionApi.delete(id);
      const next = sessions.filter((s) => s.id !== id);
      setSessions(next);
      if (sessionId === id) {
        setSessionId('');
        setMessages([]);
        if (next[0]) await openSession(next[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function connectMcp() {
    setBusy(true);
    setError('');
    try {
      const body =
        mcpTransport === 'stdio'
          ? {
              name: mcpName,
              transport: 'stdio' as const,
              config: { command: mcpCommand, args: mcpArgs.split(' ').filter(Boolean) },
            }
          : {
              name: mcpName,
              transport: 'http' as const,
              config: { url: mcpUrl },
            };
      await McpApi.connect(body);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function connectPublicMcp(preset: (typeof PUBLIC_MCP_SERVERS)[number]) {
    if (connections.some((c) => c.name === preset.name && c.status === 'connected')) {
      setError(`${preset.name} is already connected`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const token = githubToken.trim();
      if (preset.transport === 'stdio') {
        await McpApi.connect({
          name: preset.name,
          transport: 'stdio',
          config: {
            command: preset.command,
            args: [...preset.args],
            ...(token
              ? { env: { GITHUB_PERSONAL_ACCESS_TOKEN: token } }
              : {}),
          },
        });
      } else {
        await McpApi.connect({
          name: preset.name,
          transport: 'http',
          config: {
            url: preset.url,
            ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
          },
        });
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runPlayground() {
    if (!selectedTool) return;
    setBusy(true);
    setError('');
    try {
      const data = await McpApi.callTool({
        connectionId: selectedTool.connectionId,
        name: selectedTool.name,
        arguments: JSON.parse(playArgs || '{}') as Record<string, unknown>,
      });
      setPlayResult(JSON.stringify(data, null, 2));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function createDemoWorkflow() {
    if (!selectedTool) {
      setError('Connect an MCP server with tools first');
      return;
    }
    await WorkflowApi.create({
      name: wfName,
      description: 'Multi-step tool + artifact workflow',
      graph: {
        steps: [
          {
            id: 'step1',
            type: 'tool',
            connectionId: selectedTool.connectionId,
            toolName: selectedTool.name,
            args: JSON.parse(playArgs || '{}'),
            requireApproval: false,
            maxRetries: 1,
          },
          {
            id: 'step2',
            type: 'artifact',
            title: 'Workflow report',
            kind: 'markdown',
            fromStepId: 'step1',
          },
        ],
      },
    });
    await refresh();
  }

  async function runWf(id: string, background = false) {
    setBusy(true);
    try {
      const data = await WorkflowApi.run(id, { background, input: {} });
      if (data.timelineRunId) setLastRunId(data.timelineRunId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function doSearch() {
    setSearchHit(await StudioApi.search(search));
  }

  async function send() {
    if (!input.trim()) return;
    setError('');
    let id = sessionId;
    if (!id) {
      const session = await SessionApi.create({ provider, model });
      id = session.id;
      setSessionId(id);
    }
    const userText = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { id: `local_${Date.now()}`, role: 'user', content: userText }]);
    setBusy(true);
    setStreaming('');
    try {
      const { response: res, runId } = await ChatApi.send({
        sessionId: id,
        message: userText,
        provider,
        model,
      });
      setLastRunId(runId);
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let assistant = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const textMatches = [...chunk.matchAll(/"type":"text-delta"[^}]*"delta":"((?:\\.|[^"\\])*)"/g)];
        for (const match of textMatches) {
          const delta = JSON.parse(`"${match[1]}"`) as string;
          assistant += delta;
          setStreaming(assistant);
        }
      }
      if (assistant) {
        setMessages((prev) => [...prev, { id: `assistant_${Date.now()}`, role: 'assistant', content: assistant }]);
      } else {
        await openSession(id);
      }
      setStreaming('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh().catch((e) => setError(e instanceof Error ? e.message : String(e)));
    const t = setInterval(() => {
      void refresh().catch(() => undefined);
    }, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tabs: Array<{ id: WorkspaceTab; label: string }> = WORKSPACE_TABS.map((id) => ({
    id,
    label:
      id === 'tools'
        ? 'Tool Registry'
        : id.charAt(0).toUpperCase() + id.slice(1),
  }));

  return (
    <main className="studio-shell">
      <header className="top-nav">
        <div className="brand">
          <span className="brand-mark">P</span>
          Parity
        </div>
        <div className="nav-actions">
          <input
            className="field"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search servers, tools, resources"
            onKeyDown={(e) => e.key === 'Enter' && void doSearch()}
            style={{ width: 240 }}
          />
          <button className="btn-secondary" onClick={doSearch}>
            Search
          </button>
          <button className="btn-primary" onClick={createChat}>
            New chat
          </button>
        </div>
      </header>

      <nav className="tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'tab tab-active' : 'tab'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <section className="hero">
        <p className="eyebrow">MCP workspace</p>
        <h1>Build with tools that feel simple</h1>
        <p>
          Connect MCP servers, chat with agents, run workflows, and watch every tool call —
          in a calm studio with a blue accent.
        </p>
      </section>

      {error && <p className="error">{error}</p>}
      {searchHit && <pre className="pre">{JSON.stringify(searchHit, null, 2)}</pre>}

      {tab === 'chat' && (
        <div style={styles.grid}>
          <aside className="card" style={styles.panel}>
            <div className="card-header">Sessions</div>
            <div className="card-body">
              <div style={styles.list}>
                {sessions.map((s) => (
                  <div key={s.id} className="session-row">
                    <button
                      type="button"
                      className={s.id === sessionId ? 'list-item list-item-active' : 'list-item'}
                      onClick={() => openSession(s.id)}
                    >
                      {s.title}
                    </button>
                    <button
                      type="button"
                      className="session-delete"
                      title="Delete chat"
                      aria-label={`Delete ${s.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        void deleteChat(s.id);
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "16px 0" }} />
              <div className="card-header" style={{ margin: '16px -18px 12px', borderTop: '1px solid var(--line)' }}>
                Model routing
              </div>
              <label style={styles.label}>
                <span>Provider</span>
                <select
                  value={provider}
                  onChange={(e) => {
                    const next = e.target.value;
                    setProvider(next);
                    setModel(DEFAULT_MODELS[next as keyof typeof DEFAULT_MODELS] ?? model);
                  }}
                  className="field"
                >
                  <option value="ollama">Ollama</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="gemini">Gemini</option>
                </select>
              </label>
              <label style={styles.label}>
                <span>Model</span>
                <input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="field"
                />
              </label>
              {lastRunId && <p style={styles.hint}>Last run: {lastRunId}</p>}
            </div>
          </aside>
          <section className="card" style={styles.chat}>
            <div className="card-header">Chat</div>
            <div className="card-body" style={styles.panelBodyFlex}>
              <div style={styles.messages}>
                {messages.map((m) => (
                  <article
                    key={m.id}
                    className={
                      m.role === 'user'
                        ? 'msg-user'
                        : m.role === 'tool'
                          ? 'msg-assistant'
                          : 'msg-assistant'
                    }
                    style={
                      m.role === 'tool'
                        ? { borderLeft: '3px solid var(--primary)', fontSize: 13 }
                        : undefined
                    }
                  >
                    <div className="msg-role">
                      {m.role === 'tool' ? `tool · ${m.toolName ?? 'mcp'}` : m.role}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                  </article>
                ))}
                {streaming && (
                  <article className="msg-assistant">
                    <div className="msg-role">assistant</div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{streaming}</div>
                  </article>
                )}
              </div>
              <div style={styles.composer}>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  rows={3}
                  className="field"
                  style={{ minHeight: 64, resize: 'vertical' }}
                  placeholder="Ask the agent — connected MCP tools are available"
                />
                <button
                  className="btn-primary"
                  disabled={busy || !input.trim()}
                  onClick={send}
                >
                  {busy ? 'Running…' : 'Submit'}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {tab === 'servers' && (
        <section className="card" style={styles.panelWide}>
          <h2 style={styles.section}>Public MCP servers</h2>
          <p style={{ ...styles.hint, margin: '0 18px 12px' }}>
            Official and well-known servers — one click connects (npx/Docker may download on first use).
          </p>
          <div style={styles.row}>
            <label style={styles.label}>
              GitHub PAT (for GitHub MCP presets)
              <input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                className="field"
                placeholder="ghp_… or leave empty to use GITHUB_PERSONAL_ACCESS_TOKEN from .env"
                autoComplete="off"
              />
            </label>
          </div>
          <div style={styles.cards}>
            {PUBLIC_MCP_SERVERS.map((preset) => {
              const connected = connections.some(
                (c) => c.name === preset.name && c.status === 'connected',
              );
              return (
                <article key={preset.id} style={styles.card}>
                  <strong>{preset.name}</strong>
                  {preset.requiresGithubToken && (
                    <p style={{ ...styles.hint, color: 'var(--primary)', marginTop: 4 }}>Needs PAT</p>
                  )}
                  <p style={styles.hint}>{preset.description}</p>
                  <button
                    className="btn-primary"
                    disabled={busy || connected}
                    onClick={() => void connectPublicMcp(preset)}
                  >
                    {connected ? 'Connected' : 'Connect'}
                  </button>
                </article>
              );
            })}
          </div>
          <h2 style={styles.section}>Custom connection</h2>
          <div style={styles.row}>
            <label style={styles.label}>
              Name
              <input value={mcpName} onChange={(e) => setMcpName(e.target.value)} className="field" />
            </label>
            <label style={styles.label}>
              Transport
              <select
                value={mcpTransport}
                onChange={(e) => setMcpTransport(e.target.value as 'stdio' | 'http')}
                className="field"
              >
                <option value="stdio">stdio</option>
                <option value="http">Streamable HTTP</option>
              </select>
            </label>
          </div>
          {mcpTransport === 'stdio' ? (
            <div style={styles.row}>
              <label style={styles.label}>
                Command
                <input value={mcpCommand} onChange={(e) => setMcpCommand(e.target.value)} className="field" />
              </label>
              <label style={styles.label}>
                Args
                <input value={mcpArgs} onChange={(e) => setMcpArgs(e.target.value)} className="field" />
              </label>
            </div>
          ) : (
            <div style={styles.row}>
              <label style={styles.label}>
                URL
                <input value={mcpUrl} onChange={(e) => setMcpUrl(e.target.value)} className="field" />
              </label>
            </div>
          )}
          <div style={{ padding: '0 18px 8px' }}>
            <button className="btn-primary" onClick={connectMcp} disabled={busy}>
              Connect
            </button>
          </div>
          <h2 style={styles.section}>Live connections</h2>
          <ul style={{ padding: '0 18px 18px', margin: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
            {connections.map((c) => (
              <li key={c.id}>
                {c.name} · {c.transport} · {c.status}{' '}
                <button
                  className="btn-secondary"
                  onClick={async () => {
                    await McpApi.disconnect(c.id);
                    await refresh();
                  }}
                >
                  Disconnect
                </button>
              </li>
            ))}
            {connections.length === 0 && <li style={styles.hint}>No servers connected yet</li>}
          </ul>
        </section>
      )}

      {tab === 'tools' && (
        <section className="card" style={styles.panelWide}>
          <h2 style={styles.section}>Tool registry ({tools.length})</h2>
          <div style={styles.cards}>
            {tools.map((t) => (
              <article key={`${t.connectionId}:${t.name}`} style={styles.card}>
                <strong>
                  {t.connectionName}/{t.name}
                </strong>
                <p style={styles.hint}>{t.description || 'No description'}</p>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setPlayTool(`${t.connectionId}:${t.name}`);
                    setTab('playground');
                  }}
                >
                  Open in Playground
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === 'playground' && (
        <section className="card" style={styles.panelWide}>
          <h2 style={styles.section}>Tool playground</h2>
          <div style={styles.row}>
            <label style={styles.label}>
              Tool
              <select
                value={selectedTool ? `${selectedTool.connectionId}:${selectedTool.name}` : ''}
                onChange={(e) => setPlayTool(e.target.value)}
                className="field"
              >
                {tools.map((t) => (
                  <option key={`${t.connectionId}:${t.name}`} value={`${t.connectionId}:${t.name}`}>
                    {t.connectionName}/{t.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div style={styles.row}>
            <label style={styles.label}>
              Arguments JSON
              <textarea value={playArgs} onChange={(e) => setPlayArgs(e.target.value)} rows={8} className="field" />
            </label>
          </div>
          <div style={{ padding: '0 18px 8px' }}>
            <button className="btn-primary" onClick={runPlayground} disabled={busy || !selectedTool}>
              Run tool
            </button>
          </div>
          <h2 style={styles.section}>Raw response</h2>
          <pre className="pre">{playResult || 'No result yet'}</pre>
        </section>
      )}

      {tab === 'resources' && (
        <section className="card" style={styles.panelWide}>
          <h2 style={styles.section}>Resource explorer</h2>
          <ul>
            {resources.map((r) => (
              <li key={`${r.connectionId}:${r.uri}`}>
                <strong>{r.connectionName}</strong> · {r.name} · <code>{r.uri}</code>
                <button
                  className="btn-secondary"
                  onClick={async () => {
                    const data = await McpApi.readResource({
                      connectionId: r.connectionId,
                      uri: r.uri,
                    });
                    setPlayResult(JSON.stringify(data, null, 2));
                    setTab('playground');
                  }}
                >
                  Read
                </button>
              </li>
            ))}
            {resources.length === 0 && <li style={styles.hint}>No resources from connected servers</li>}
          </ul>
        </section>
      )}

      {tab === 'prompts' && (
        <section className="card" style={styles.panelWide}>
          <h2 style={styles.section}>Prompt explorer</h2>
          <ul>
            {prompts.map((p) => (
              <li key={`${p.connectionId}:${p.name}`}>
                <strong>{p.connectionName}</strong>/{p.name} — {p.description || 'No description'}
              </li>
            ))}
            {prompts.length === 0 && <li style={styles.hint}>No prompts from connected servers</li>}
          </ul>
        </section>
      )}

      {tab === 'workflows' && (
        <section className="card" style={styles.panelWide}>
          <h2 style={styles.section}>Workflow builder</h2>
          <div style={styles.row}>
            <label style={styles.label}>
              Name
              <input value={wfName} onChange={(e) => setWfName(e.target.value)} className="field" />
            </label>
            <button className="btn-primary" onClick={() => void createDemoWorkflow().catch((e) => setError(String(e)))}>
              Create from selected tool
            </button>
          </div>
          <p style={styles.hint}>Creates: Tool step → Artifact report (multi-step orchestration).</p>
          <h2 style={styles.section}>Workflows</h2>
          <ul>
            {workflows.map((w) => (
              <li key={String(w.id)}>
                <strong>{String(w.name)}</strong>{' '}
                <button className="btn-secondary" onClick={() => void runWf(String(w.id), false)}>
                  Run now
                </button>{' '}
                <button className="btn-secondary" onClick={() => void runWf(String(w.id), true)}>
                  Background
                </button>
              </li>
            ))}
          </ul>
          <h2 style={styles.section}>Pending approvals (HITL)</h2>
          <ul>
            {approvals.map((a) => (
              <li key={String(a.id)}>
                {String(a.toolName)}{' '}
                <button
                  className="btn-primary"
                  onClick={async () => {
                    await ApprovalApi.resolve(a.id, { status: 'approved' });
                    await refresh();
                  }}
                >
                  Approve
                </button>{' '}
                <button
                  className="btn-secondary"
                  onClick={async () => {
                    await ApprovalApi.resolve(a.id, {
                      status: 'rejected',
                      note: 'Rejected by operator',
                    });
                    await refresh();
                  }}
                >
                  Reject
                </button>
              </li>
            ))}
            {approvals.length === 0 && <li style={styles.hint}>No pending approvals</li>}
          </ul>
          <h2 style={styles.section}>Background jobs</h2>
          <pre className="pre">{JSON.stringify(jobs.slice(0, 5), null, 2)}</pre>
          <h2 style={styles.section}>Artifacts</h2>
          <ul>
            {artifacts.slice(0, 8).map((a) => (
              <li key={String(a.id)}>
                <strong>{String(a.title)}</strong> · {String(a.kind)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'observability' && (
        <section className="card" style={styles.panelWide}>
          <h2 style={styles.section}>Metrics</h2>
          <div style={styles.cards}>
            <article style={styles.card}>Events: {metrics.events ?? 0}</article>
            <article style={styles.card}>Latency Σ: {metrics.totalLatencyMs ?? 0} ms</article>
            <article style={styles.card}>
              Tokens: {(metrics.promptTokens ?? 0) + (metrics.completionTokens ?? 0)}
            </article>
            <article style={styles.card}>Cost: ${Number(metrics.costUsd ?? 0).toFixed(6)}</article>
          </div>
          <h2 style={styles.section}>Execution timeline</h2>
          <div style={styles.timeline}>
            {events.slice(0, 40).map((e) => (
              <div key={e.id} style={styles.timelineItem}>
                <div style={styles.role}>{e.kind}</div>
                <strong>{e.label}</strong>
                <div style={styles.hint}>
                  {e.status} · {e.latencyMs}ms · tokens {e.tokensPrompt + e.tokensCompletion} · run {e.runId}
                </div>
              </div>
            ))}
          </div>
          <h2 style={styles.section}>Plugins</h2>
          <pre className="pre">{JSON.stringify(plugins, null, 2)}</pre>
        </section>
      )}
      <footer className="footer">
        <span style={{ color: 'var(--primary)', fontWeight: 700 }}>MCP Studio</span>
        {' '}· © Parity
      </footer>
    </main>
  );
}


const styles: Record<string, React.CSSProperties> = {
  grid: { display: 'grid', gridTemplateColumns: 'minmax(240px, 300px) 1fr', gap: 16 },
  panel: { minHeight: 520 },
  panelWide: { marginTop: 8, paddingBottom: 8 },
  panelBodyFlex: { display: 'flex', flexDirection: 'column', minHeight: 460 },
  chat: { minHeight: 520, display: 'flex', flexDirection: 'column' },
  section: { margin: '16px 18px 8px', color: 'var(--ink)', fontSize: 15, fontWeight: 700 },
  list: { display: 'grid', gap: 8 },
  label: { display: 'grid', gap: 6, marginBottom: 12, flex: 1 },
  hint: { margin: '4px 0', fontSize: 13, color: 'var(--muted)' },
  messages: { flex: 1, overflow: 'auto', display: 'grid', gap: 10, alignContent: 'start' },
  composer: { display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginTop: 12 },
  row: { display: 'flex', gap: 12, flexWrap: 'wrap', padding: '0 18px 8px' },
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 12,
    padding: '0 18px 18px',
  },
  card: {
    background: 'var(--canvas)',
    border: '1px solid var(--line)',
    borderRadius: 16,
    padding: 16,
    boxShadow: 'var(--shadow-soft)',
  },
  timeline: { display: 'grid', gap: 8, padding: '0 18px 18px' },
  timelineItem: {
    background: '#f7f7f7',
    borderRadius: 12,
    padding: '12px 14px',
    borderLeft: '3px solid var(--primary)',
  },
  role: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 4 },
};

