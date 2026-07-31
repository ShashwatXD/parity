'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Globe, Menu, PanelRight } from 'lucide-react';
import {
  approvalRepository,
  chatRepository,
  mcpRepository,
  observabilityRepository,
  sessionRepository,
  settingsRepository,
  studioRepository,
  workflowRepository,
} from '@/lib/api';
import {
  DEFAULT_MCP,
  DEFAULT_MODELS,
  DEFAULT_PROVIDER,
  PRIMARY_NAV,
  type PublicMcpPreset,
} from '@/lib/constants';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';
import { notifyWorkspaceChanged } from '@/lib/workspace/events';
import type {
  Approval,
  Artifact,
  BackgroundJob,
  ContextSnapshot,
  DiscoveredPrompt,
  DiscoveredResource,
  DiscoveredTool,
  ExecutionEvent,
  McpConnection,
  Message,
  MetricsSummary,
  NavItemId,
  PluginInfo,
  PublicLlmProfile,
  RightPanelTab,
  Session,
  Workflow,
} from '@/lib/models';
import { AppShell } from '@/components/layout/AppShell';
import { RightPanel, WorkspacePlaceholder } from '@/components/layout/RightPanel';
import { Sidebar } from '@/components/layout/Sidebar';
import { ChatComposer } from '@/components/features/chat/ChatComposer';
import { ChatMessages } from '@/components/features/chat/ChatMessages';
import { ContextMeter } from '@/components/features/chat/ContextMeter';
import { PromptsPanel, ResourcesPanel } from '@/components/features/mcp/CatalogPanels';
import { McpServersPanel } from '@/components/features/mcp/McpServersPanel';
import { ObservabilityPanel } from '@/components/features/observability/ObservabilityPanel';
import { TimelineEventRow } from '@/components/features/observability/EventInspector';
import { MemoryPanel } from '@/components/features/memory/MemoryPanel';
import { PlaygroundPanel } from '@/components/features/playground/PlaygroundPanel';
import { SettingsPanel } from '@/components/features/settings/SettingsPanel';
import { ToolsPanel } from '@/components/features/tools/ToolsPanel';
import { FilesPanel } from '@/components/features/workspace/FilesPanel';
import { TerminalPanel } from '@/components/features/workspace/TerminalPanel';
import { WorkflowsPanel } from '@/components/features/workflows/WorkflowsPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PanelCard } from '@/components/ui/Panel';

export function StudioApp() {
  const breakpoint = useBreakpoint();
  const [nav, setNav] = useState<NavItemId>('chat');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState(false);
  const [panelOpenMobile, setPanelOpenMobile] = useState(false);
  const [rightTab, setRightTab] = useState<RightPanelTab>('tools');

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
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState('');
  const [runEvents, setRunEvents] = useState<ExecutionEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  /** Keep harness chips until next send or session switch (survives refresh races). */
  function retainRunEvents(next: ExecutionEvent[]) {
    if (!next.length) return;
    setRunEvents(next);
  }

  function clearRunEvents() {
    setRunEvents([]);
  }
  const [error, setError] = useState('');
  const [provider, setProvider] = useState<string>(DEFAULT_PROVIDER);
  const [model, setModel] = useState<string>(DEFAULT_MODELS.ollama);
  const [profiles, setProfiles] = useState<PublicLlmProfile[]>([]);
  const [profileId, setProfileId] = useState('');
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
  const [context, setContext] = useState<ContextSnapshot | null>(null);

  const selectedTool = useMemo(
    () => tools.find((t) => `${t.connectionId}:${t.name}` === playTool) ?? tools[0],
    [tools, playTool],
  );

  const activeSession = sessions.find((s) => s.id === sessionId);
  const pageTitle = PRIMARY_NAV.find((n) => n.id === nav)?.label ?? 'Parity';

  function applySettings(s: {
    activeProfileId: string;
    defaultProvider: string;
    defaultModel: string;
    profiles: PublicLlmProfile[];
  }) {
    setProfiles(s.profiles);
    const active =
      s.profiles.find((p) => p.id === s.activeProfileId) ??
      s.profiles.find((p) => p.id === profileId) ??
      s.profiles[0];
    if (active) {
      setProfileId(active.id);
      setProvider(active.provider);
      setModel(active.model);
    } else {
      setProvider(s.defaultProvider);
      setModel(s.defaultModel || DEFAULT_MODELS.ollama);
    }
  }

  function selectProfile(id: string) {
    const profile = profiles.find((p) => p.id === id);
    if (!profile) return;
    setProfileId(profile.id);
    setProvider(profile.provider);
    setModel(profile.model);
    void settingsRepository.update({ activeProfileId: profile.id }).catch(() => undefined);
  }

  async function refreshContext(id = sessionId, p = provider, m = model) {
    if (!id) {
      setContext(null);
      return;
    }
    try {
      setContext(await sessionRepository.context(id, { provider: p, model: m }));
    } catch {
      /* ignore while session boots */
    }
  }

  async function openSession(id: string) {
    const switching = id !== sessionIdRef.current;
    setSessionId(id);
    sessionIdRef.current = id;
    if (switching) clearRunEvents();
    const data = await sessionRepository.get(id);
    setMessages(data.messages ?? []);
    await refreshContext(id, provider, model);
  }

  async function reloadMessages(id: string) {
    const data = await sessionRepository.get(id);
    setMessages(data.messages ?? []);
  }

  async function refresh() {
    const [s, c, t, r, p, e, m, w, a, art, j, pl] = await Promise.all([
      sessionRepository.list(),
      mcpRepository.connections(),
      mcpRepository.tools(),
      mcpRepository.resources(),
      mcpRepository.prompts(),
      observabilityRepository.events(),
      observabilityRepository.metrics(),
      workflowRepository.list(),
      approvalRepository.listPending(),
      studioRepository.artifacts(),
      studioRepository.jobs(),
      studioRepository.plugins(),
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
    // Use ref — interval refresh closes over a stale empty sessionId otherwise
    // and re-opens the first session every 8s, wiping harness chips.
    if (!sessionIdRef.current && s[0]) await openSession(s[0].id);
  }

  async function createChat() {
    const session = await sessionRepository.create({ provider, model, title: 'New conversation' });
    await refresh();
    await openSession(session.id);
    setNav('chat');
  }

  async function deleteChat(id: string) {
    setError('');
    try {
      await sessionRepository.delete(id);
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
      await mcpRepository.connect(body);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function disconnectMcp(id: string) {
    setBusy(true);
    setError('');
    try {
      await mcpRepository.disconnect(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function connectPublicMcp(preset: PublicMcpPreset) {
    if (connections.some((c) => c.name === preset.name && c.status === 'connected')) {
      setError(`${preset.name} is already connected`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const token = githubToken.trim();
      if (preset.transport === 'stdio') {
        await mcpRepository.connect({
          name: preset.name,
          transport: 'stdio',
          config: {
            command: preset.command,
            args: [...preset.args],
            ...(token ? { env: { GITHUB_PERSONAL_ACCESS_TOKEN: token } } : {}),
          },
        });
      } else {
        await mcpRepository.connect({
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
      const data = await mcpRepository.callTool({
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
    await workflowRepository.create({
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
      const data = await workflowRepository.run(id, { background, input: {} });
      if (data.timelineRunId) setLastRunId(data.timelineRunId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!input.trim()) return;
    setError('');
    let id = sessionId;
    if (!id) {
      const session = await sessionRepository.create({ provider, model, title: 'New conversation' });
      id = session.id;
      setSessionId(id);
    }
    const userText = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { id: `local_${Date.now()}`, role: 'user', content: userText }]);
    setBusy(true);
    setStreaming('');
    clearRunEvents();
    try {
      const { response: res, runId } = await chatRepository.send({
        sessionId: id,
        message: userText,
        profileId,
      });
      setLastRunId(runId);
      let pollActive = true;
      const poll = window.setInterval(() => {
        if (!runId || !pollActive) return;
        void observabilityRepository.events(runId).then((ev) => {
          if (!pollActive) return;
          retainRunEvents(ev);
          const touchedFs = ev.some(
            (e) =>
              /file_editor|terminal|write|glob/i.test(e.label) ||
              /file_editor|terminal/i.test(e.kind),
          );
          if (touchedFs) notifyWorkspaceChanged();
        }).catch(() => undefined);
        void sessionRepository.get(id).then((s) => {
          if (!pollActive) return;
          if (s.messages?.length) setMessages(s.messages);
        }).catch(() => undefined);
      }, 900);
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let assistant = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const textMatches = [
            ...chunk.matchAll(/"type":"text-delta"[^}]*"delta":"((?:\\.|[^"\\])*)"/g),
          ];
          for (const match of textMatches) {
            const delta = JSON.parse(`"${match[1]}"`) as string;
            assistant += delta;
            setStreaming(assistant);
          }
        }
      } finally {
        pollActive = false;
        window.clearInterval(poll);
      }
      if (runId) {
        const finalEvents = await observabilityRepository.events(runId).catch(() => []);
        retainRunEvents(finalEvents);
      }
      await reloadMessages(id);
      setStreaming('');
      await refresh();
      await refreshContext(id);
      if (runId) {
        const finalEvents = await observabilityRepository.events(runId).catch(() => []);
        retainRunEvents(finalEvents);
      }
      notifyWorkspaceChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (breakpoint === 'tablet') setSidebarCollapsed(true);
    if (breakpoint === 'desktop') setSidebarCollapsed(false);
    if (breakpoint === 'desktop') {
      setSidebarOpenMobile(false);
      setPanelOpenMobile(false);
    }
  }, [breakpoint]);

  useEffect(() => {
    refresh().catch((e) => setError(e instanceof Error ? e.message : String(e)));
    settingsRepository
      .get()
      .then((s) => applySettings(s))
      .catch(() => undefined);
    const t = setInterval(() => {
      void refresh().catch(() => undefined);
    }, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tools[0] && !playTool) {
      setPlayTool(`${tools[0].connectionId}:${tools[0].name}`);
    }
  }, [tools, playTool]);

  useEffect(() => {
    void refreshContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, provider, model]);

  const rightPanelContent = (() => {
    if (rightTab === 'files') {
      return <FilesPanel />;
    }
    if (rightTab === 'terminal') {
      return <TerminalPanel />;
    }
    if (rightTab === 'browser') {
      return (
        <WorkspacePlaceholder
          icon={<Globe size={22} />}
          title="Browser"
          description="Live browser observations for agent navigation — MCP Playwright already connects today."
        />
      );
    }
    if (rightTab === 'timeline') {
      return (
        <div className="pad stack">
          <PanelCard>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <strong>Live timeline</strong>
              <Badge tone="accent">{events.length} events</Badge>
            </div>
            <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
              Click a chip to inspect args, results, or memory gate decisions.
            </p>
            <div className="stack" style={{ marginTop: 10 }}>
              {events.slice(0, 24).map((e) => (
                <TimelineEventRow key={e.id} event={e} />
              ))}
            </div>
          </PanelCard>
        </div>
      );
    }
    return (
      <div className="pad stack">
        <PanelCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <strong>MCP tools</strong>
            <Badge tone="accent">{tools.length}</Badge>
          </div>
          <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
            {connections.length} servers connected · agent can call these in chat
          </p>
        </PanelCard>
        <ToolsPanel tools={tools.slice(0, 40)} />
      </div>
    );
  })();

  function navigate(id: NavItemId) {
    setNav(id);
    setSidebarOpenMobile(false);
    if (id !== 'chat') setPanelOpenMobile(false);
  }

  const rightPanelNode =
    nav === 'chat' ? (
      <RightPanel tab={rightTab} onTabChange={setRightTab}>
        {rightPanelContent}
      </RightPanel>
    ) : undefined;

  return (
    <AppShell
      breakpoint={breakpoint}
      sidebarCollapsed={sidebarCollapsed}
      sidebarOpenMobile={sidebarOpenMobile}
      panelOpenMobile={panelOpenMobile}
      showRightPanel={nav === 'chat'}
      error={error}
      onCloseSidebarMobile={() => setSidebarOpenMobile(false)}
      onClosePanelMobile={() => setPanelOpenMobile(false)}
      sidebar={
        <Sidebar
          active={nav}
          collapsed={breakpoint === 'mobile' ? false : sidebarCollapsed}
          sessions={sessions}
          sessionId={sessionId}
          connectionCount={connections.length}
          onNavigate={navigate}
          onToggle={() => {
            if (breakpoint === 'mobile') setSidebarOpenMobile(false);
            else setSidebarCollapsed((v) => !v);
          }}
          onNewChat={() => {
            void createChat();
            setSidebarOpenMobile(false);
          }}
          onOpenSession={(id) => {
            void openSession(id);
            setSidebarOpenMobile(false);
          }}
          onDeleteSession={(id) => void deleteChat(id)}
        />
      }
      rightPanel={rightPanelNode}
    >
      {nav === 'chat' ? (
        <>
          <div className="chat-header">
            <Button
              variant="ghost"
              icon
              className="header-icon-btn"
              aria-label="Open menu"
              onClick={() => setSidebarOpenMobile(true)}
            >
              <Menu size={18} />
            </Button>
            <span className="chat-header-title">
              {activeSession?.title ?? 'New conversation'}
            </span>
            <span className="chat-header-status">
              <span className={`status-dot${busy ? ' busy' : ''}`} />
              {busy ? 'Running' : 'Idle'}
              <span className="status-extra">
                {connections.length > 0 ? ` · ${connections.length} MCP` : ''}
                {lastRunId ? ` · ${lastRunId.slice(0, 8)}` : ''}
              </span>
            </span>
            <div className="chat-header-actions">
              <ContextMeter context={context} />
              <Badge tone="accent" className="badge-provider-mobile-hide">
                {provider}
              </Badge>
              <Button
                variant="ghost"
                icon
                className="header-icon-btn workspace-toggle"
                aria-label="Open workspace"
                onClick={() => setPanelOpenMobile(true)}
              >
                <PanelRight size={18} />
              </Button>
            </div>
          </div>
          <ChatMessages
            messages={messages}
            streaming={streaming}
            runEvents={runEvents}
            busy={busy && nav === 'chat'}
          />
          <ChatComposer
            value={input}
            busy={busy}
            profiles={profiles}
            profileId={profileId}
            onChange={setInput}
            onProfileChange={selectProfile}
            onSend={() => void send()}
            onOpenSettings={() => navigate('settings')}
          />
        </>
      ) : (
        <div className="page-view">
          <div className="page-view-header">
            <Button
              variant="ghost"
              icon
              className="header-icon-btn"
              aria-label="Open menu"
              onClick={() => setSidebarOpenMobile(true)}
            >
              <Menu size={18} />
            </Button>
            <h1>{pageTitle}</h1>
            {nav === 'servers' ? <Badge tone="accent">{connections.length} live</Badge> : null}
            {nav === 'tools' ? <Badge>{tools.length} tools</Badge> : null}
          </div>
          <div className="page-view-body">
            {nav === 'servers' ? (
              <>
                <McpServersPanel
                  connections={connections}
                  busy={busy}
                  mcpName={mcpName}
                  mcpTransport={mcpTransport}
                  mcpCommand={mcpCommand}
                  mcpArgs={mcpArgs}
                  mcpUrl={mcpUrl}
                  githubToken={githubToken}
                  onName={setMcpName}
                  onTransport={setMcpTransport}
                  onCommand={setMcpCommand}
                  onArgs={setMcpArgs}
                  onUrl={setMcpUrl}
                  onGithubToken={setGithubToken}
                  onConnect={() => void connectMcp()}
                  onDisconnect={(id) => void disconnectMcp(id)}
                  onConnectPreset={(preset) => void connectPublicMcp(preset)}
                />
                <div className="pad grid-2">
                  <ResourcesPanel resources={resources} />
                  <PromptsPanel prompts={prompts} />
                </div>
              </>
            ) : null}
            {nav === 'tools' ? <ToolsPanel tools={tools} /> : null}
            {nav === 'playground' ? (
              <PlaygroundPanel
                tools={tools}
                playTool={
                  playTool ||
                  (selectedTool ? `${selectedTool.connectionId}:${selectedTool.name}` : '')
                }
                playArgs={playArgs}
                playResult={playResult}
                busy={busy}
                onPlayTool={setPlayTool}
                onPlayArgs={setPlayArgs}
                onRun={() => void runPlayground()}
              />
            ) : null}
            {nav === 'workflows' ? (
              <WorkflowsPanel
                workflows={workflows}
                approvals={approvals}
                artifacts={artifacts}
                jobs={jobs}
                wfName={wfName}
                busy={busy}
                onWfName={setWfName}
                onCreateDemo={() => void createDemoWorkflow()}
                onRun={(id, bg) => void runWf(id, bg)}
                onResolve={(id, status) =>
                  void approvalRepository.resolve(id, { status }).then(refresh)
                }
              />
            ) : null}
            {nav === 'observability' ? (
              <ObservabilityPanel events={events} metrics={metrics} plugins={plugins} />
            ) : null}
            {nav === 'memory' ? <MemoryPanel /> : null}
            {nav === 'settings' ? (
              <SettingsPanel onSaved={(s) => applySettings(s)} />
            ) : null}
          </div>
        </div>
      )}
    </AppShell>
  );
}
