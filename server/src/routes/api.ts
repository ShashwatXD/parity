import { Hono } from 'hono';
import { z } from 'zod';
import { API_ROUTES, HEADER_RUN_ID, SERVICE_NAME } from '../constants.js';
import { connectInputSchema, mcpManager } from '../mcp/manager.js';
import { providerSchema } from '../llm/providers.js';
import { listPlugins } from '../plugins/pluginSdk.js';
import { listEvents, metricsSummary } from '../observability/timeline.js';
import { McpConnectionRepository } from '../repositories/mcpConnectionRepository.js';
import { SessionRepository } from '../repositories/sessionRepository.js';
import { listArtifacts } from '../runtime/artifacts.js';
import { runAgentTurn } from '../runtime/agent.js';
import { buildContextSnapshot } from '../runtime/contextWindow.js';
import { enqueueJob, listJobs } from '../runtime/jobs.js';
import { getPublicSettings, updateSettings } from '../runtime/settings.js';
import {
  createSession,
  deleteSession,
  getSession,
  listMessages,
} from '../runtime/sessions.js';
import {
  createWorkflow,
  listApprovals,
  listWorkflows,
  resolveApproval,
  runWorkflow,
  type WorkflowGraph,
} from '../runtime/workflows.js';
import { listSkills } from '../agent/skills.js';
import { listWorkspaceTree, readWorkspaceFile, writeWorkspaceFile } from '../workspace/files.js';
import { gitDiff, gitStatus } from '../workspace/git.js';
import { getWorkspaceRoot } from '../workspace/paths.js';
import { listTerminalHistory, runInWorkspace } from '../workspace/terminal.js';

export const api = new Hono();

api.get(API_ROUTES.health, (c) =>
  c.json({ ok: true, service: SERVICE_NAME, phases: [1, 2, 3, 4] }),
);

api.get(API_ROUTES.sessions, (c) => {
  return c.json(SessionRepository.list(c.req.query('q') ?? undefined));
});

api.post(API_ROUTES.sessions, async (c) => {
  const body = z
    .object({
      title: z.string().optional(),
      provider: providerSchema.optional(),
      model: z.string().optional(),
    })
    .parse(await c.req.json().catch(() => ({})));
  return c.json(createSession(body), 201);
});

api.get('/sessions/:id', (c) => {
  const session = getSession(c.req.param('id'));
  if (!session) return c.json({ error: 'Session not found' }, 404);
  return c.json({ ...session, messages: listMessages(session.id) });
});

api.get('/sessions/:id/context', (c) => {
  const session = getSession(c.req.param('id'));
  if (!session) return c.json({ error: 'Session not found' }, 404);
  const provider = c.req.query('provider') ?? session.provider;
  const model = c.req.query('model') ?? session.model;
  return c.json(
    buildContextSnapshot({
      sessionId: session.id,
      provider,
      model,
    }),
  );
});

api.delete('/sessions/:id', (c) => {
  const id = c.req.param('id');
  if (!deleteSession(id)) return c.json({ error: 'Session not found' }, 404);
  return c.json({ ok: true });
});

api.get(API_ROUTES.search, async (c) => {
  const q = c.req.query('q') ?? '';
  const tools = await mcpManager.listTools();
  const resources = await mcpManager.listResources();
  const prompts = await mcpManager.listPrompts();
  const needle = q.toLowerCase();
  return c.json({
    query: q,
    sessions: SessionRepository.list(q),
    connections: mcpManager.search(q).connections,
    tools: tools.filter(
      (t) =>
        t.name.toLowerCase().includes(needle) ||
        t.description.toLowerCase().includes(needle) ||
        t.connectionName.toLowerCase().includes(needle),
    ),
    resources: resources.filter(
      (r) =>
        r.name.toLowerCase().includes(needle) ||
        r.uri.toLowerCase().includes(needle) ||
        r.connectionName.toLowerCase().includes(needle),
    ),
    prompts: prompts.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.description.toLowerCase().includes(needle),
    ),
  });
});

api.get(API_ROUTES.mcpConnections, (c) => {
  return c.json({
    live: mcpManager.listLive(),
    saved: McpConnectionRepository.listSaved(),
  });
});

api.post(API_ROUTES.mcpConnect, async (c) => {
  try {
    const input = connectInputSchema.parse(await c.req.json());
    const result = await mcpManager.connect(input);
    return c.json(result, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ error: message }, 400);
  }
});

api.delete('/mcp/connections/:id', async (c) => {
  await mcpManager.disconnect(c.req.param('id'));
  return c.json({ ok: true });
});

api.get(API_ROUTES.mcpTools, async (c) => {
  return c.json(await mcpManager.listTools(c.req.query('connectionId')));
});

api.post(API_ROUTES.mcpToolCall, async (c) => {
  try {
    const body = z
      .object({
        connectionId: z.string(),
        name: z.string(),
        arguments: z.record(z.unknown()).default({}),
      })
      .parse(await c.req.json());
    const started = Date.now();
    const result = await mcpManager.callTool(body.connectionId, body.name, body.arguments);
    return c.json({ result, latencyMs: Date.now() - started });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ error: message }, 400);
  }
});

api.get(API_ROUTES.mcpResources, async (c) => {
  return c.json(await mcpManager.listResources(c.req.query('connectionId')));
});

api.post(API_ROUTES.mcpResourceRead, async (c) => {
  try {
    const body = z
      .object({ connectionId: z.string(), uri: z.string() })
      .parse(await c.req.json());
    return c.json(await mcpManager.readResource(body.connectionId, body.uri));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ error: message }, 400);
  }
});

api.get(API_ROUTES.mcpPrompts, async (c) => {
  return c.json(await mcpManager.listPrompts(c.req.query('connectionId')));
});

api.post(API_ROUTES.mcpPromptGet, async (c) => {
  try {
    const body = z
      .object({
        connectionId: z.string(),
        name: z.string(),
        arguments: z.record(z.string()).optional(),
      })
      .parse(await c.req.json());
    return c.json(await mcpManager.getPrompt(body.connectionId, body.name, body.arguments));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ error: message }, 400);
  }
});

api.get(API_ROUTES.oauthStatus, (c) =>
  c.json({
    appAuth: 'disabled',
    mcpOAuth: 'ready-for-phase-2-providers',
    note: 'OAuth providers can plug into Streamable HTTP MCP transports via SDK auth helpers.',
  }),
);

api.get(API_ROUTES.workflows, (c) => c.json(listWorkflows()));

api.post(API_ROUTES.workflows, async (c) => {
  const body = z
    .object({
      name: z.string().min(1),
      description: z.string().optional(),
      graph: z.object({
        steps: z.array(z.record(z.unknown())),
      }),
    })
    .parse(await c.req.json());
  return c.json(
    createWorkflow({
      name: body.name,
      description: body.description,
      graph: body.graph as unknown as WorkflowGraph,
    }),
    201,
  );
});

api.post('/workflows/:id/run', async (c) => {
  try {
    const body = z
      .object({
        input: z.record(z.unknown()).default({}),
        background: z.boolean().default(false),
      })
      .parse(await c.req.json().catch(() => ({})));
    if (body.background) {
      return c.json(
        enqueueJob('workflow', { workflowId: c.req.param('id'), input: body.input }),
        202,
      );
    }
    return c.json(await runWorkflow(c.req.param('id'), body.input));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ error: message }, 400);
  }
});

api.get(API_ROUTES.approvals, (c) => c.json(listApprovals(c.req.query('status'))));

api.post('/approvals/:id/resolve', async (c) => {
  const body = z
    .object({
      status: z.enum(['approved', 'rejected']),
      note: z.string().optional(),
    })
    .parse(await c.req.json());
  return c.json(resolveApproval(c.req.param('id'), body.status, body.note));
});

api.get(API_ROUTES.jobs, (c) => c.json(listJobs()));
api.get(API_ROUTES.artifacts, (c) => c.json(listArtifacts()));
api.get(API_ROUTES.plugins, (c) => c.json(listPlugins()));

api.get(API_ROUTES.observabilityEvents, (c) => {
  return c.json(listEvents(c.req.query('runId'), c.req.query('sessionId')));
});

api.get(API_ROUTES.observabilityMetrics, (c) => c.json(metricsSummary()));

api.get(API_ROUTES.settings, (c) => c.json(getPublicSettings()));

api.put(API_ROUTES.settings, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  return c.json(updateSettings(body));
});

api.get(API_ROUTES.workspaceRoot, (c) =>
  c.json({ root: getWorkspaceRoot() }),
);

api.get(API_ROUTES.workspaceTree, (c) => {
  try {
    const path = c.req.query('path') ?? '.';
    const depth = Number(c.req.query('depth') ?? '3');
    return c.json({
      root: getWorkspaceRoot(),
      tree: listWorkspaceTree(path, Number.isFinite(depth) ? depth : 3),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ error: message }, 400);
  }
});

api.get(API_ROUTES.workspaceFile, (c) => {
  try {
    const path = c.req.query('path');
    if (!path) return c.json({ error: 'path is required' }, 400);
    return c.json(readWorkspaceFile(path));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ error: message }, 400);
  }
});

api.put(API_ROUTES.workspaceFile, async (c) => {
  try {
    const body = z
      .object({ path: z.string().min(1), content: z.string() })
      .parse(await c.req.json());
    return c.json(writeWorkspaceFile(body.path, body.content));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ error: message }, 400);
  }
});

api.get(API_ROUTES.workspaceTerminalHistory, (c) => {
  const limit = Number(c.req.query('limit') ?? '40');
  return c.json(listTerminalHistory(Number.isFinite(limit) ? limit : 40));
});

api.post(API_ROUTES.workspaceTerminal, async (c) => {
  try {
    const body = z
      .object({
        command: z.string().min(1),
        timeoutMs: z.number().int().min(1000).max(120_000).optional(),
      })
      .parse(await c.req.json());
    return c.json(await runInWorkspace(body));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ error: message }, 400);
  }
});

api.get(API_ROUTES.workspaceGit, async (c) => {
  const includeDiff = c.req.query('diff') === '1';
  const status = await gitStatus();
  if (!includeDiff) return c.json(status);
  const diff = await gitDiff(c.req.query('staged') === '1');
  return c.json({ ...status, ...diff });
});

api.get(API_ROUTES.workspaceSkills, (c) =>
  c.json(
    listSkills().map((s) => ({
      name: s.name,
      description: s.description,
      triggers: s.triggers,
    })),
  ),
);

api.post(API_ROUTES.chat, async (c) => {
  try {
    const body = z
      .object({
        sessionId: z.string().min(1),
        message: z.string().min(1),
        profileId: z.string().optional(),
        provider: providerSchema.optional(),
        model: z.string().optional(),
      })
      .parse(await c.req.json());

    const session = getSession(body.sessionId);
    if (!session) return c.json({ error: 'Session not found' }, 404);

    const { result, runId } = await runAgentTurn({
      sessionId: body.sessionId,
      userMessage: body.message,
      profileId: body.profileId,
    });

    const response = result.toUIMessageStreamResponse();
    response.headers.set(HEADER_RUN_ID, runId);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ error: message }, 400);
  }
});
