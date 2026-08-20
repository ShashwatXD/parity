import { test, expect } from '@playwright/test';

const API = process.env.E2E_API_URL ?? 'http://127.0.0.1:5005/api';

/**
 * API-level E2E (no browser) — contract checks against the live Hono server.
 * Uses absolute URLs so we never hit the Next.js UI origin by mistake.
 * Avoids live LLM calls (no POST /teams/run execution).
 */
test.describe('API health & core routes', () => {
  test('GET /health is ok', async ({ request }) => {
    const res = await request.get(`${API}/health`);
    expect(res.ok(), await res.text()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.service).toBe('parity-mcp-studio');
  });

  test('GET /settings returns profiles', async ({ request }) => {
    const res = await request.get(`${API}/settings`);
    expect(res.ok(), await res.text()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.profiles)).toBe(true);
    expect(body.profiles.length).toBeGreaterThan(0);
  });

  test('GET /sessions lists chats', async ({ request }) => {
    const res = await request.get(`${API}/sessions`);
    expect(res.ok(), await res.text()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('POST /sessions creates a session', async ({ request }) => {
    const res = await request.post(`${API}/sessions`, {
      data: { title: 'e2e-session', provider: 'ollama', model: 'qwen2.5:3b' },
    });
    expect(res.status(), await res.text()).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
  });

  test('GET /mcp/connections returns live/saved shape', async ({ request }) => {
    const res = await request.get(`${API}/mcp/connections`);
    expect(res.ok(), await res.text()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('live');
    expect(body).toHaveProperty('saved');
  });

  test('GET /workspace returns a root path', async ({ request }) => {
    const res = await request.get(`${API}/workspace`);
    expect(res.ok(), await res.text()).toBeTruthy();
    const body = await res.json();
    expect(typeof body.root).toBe('string');
    expect(body.root.length).toBeGreaterThan(0);
  });
});

test.describe('API agents & teams', () => {
  test('GET /agents returns default roster', async ({ request }) => {
    const res = await request.get(`${API}/agents`);
    expect(res.ok(), await res.text()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    const names = body.map((a: { name: string }) => a.name);
    for (const required of ['director', 'researcher', 'coder', 'reviewer', 'synthesizer']) {
      expect(names, `missing ${required}`).toContain(required);
    }
  });

  test('POST /agents creates and DELETE removes an agent', async ({ request }) => {
    const name = `e2e_agent_${Date.now()}`;
    const create = await request.post(`${API}/agents`, {
      data: {
        name,
        description: 'e2e agent',
        systemPrompt: 'You are a test agent.',
        tools: 'none',
        maxSteps: 3,
      },
    });
    expect(create.status(), await create.text()).toBe(201);
    const created = await create.json();
    expect(created.id).toBeTruthy();
    expect(created.name).toBe(name);
    expect(created.tools).toBe('none');

    const get = await request.get(`${API}/agents/${created.id}`);
    expect(get.ok(), await get.text()).toBeTruthy();

    const del = await request.delete(`${API}/agents/${created.id}`);
    expect(del.ok(), await del.text()).toBeTruthy();

    const missing = await request.get(`${API}/agents/${created.id}`);
    expect(missing.status()).toBe(404);
  });

  test('GET /teams lists team runs', async ({ request }) => {
    const res = await request.get(`${API}/teams`);
    expect(res.ok(), await res.text()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('POST /workflows persists a team step graph', async ({ request }) => {
    const res = await request.post(`${API}/workflows`, {
      data: {
        name: `e2e-team-wf-${Date.now()}`,
        description: 'e2e multi-agent workflow',
        graph: {
          steps: [
            {
              id: 'team1',
              type: 'team',
              task: 'List risks in the auth flow',
              maxLoops: 1,
              parallel: true,
            },
            {
              id: 'report',
              type: 'artifact',
              title: 'Team synthesis',
              kind: 'markdown',
              fromStepId: 'team1',
            },
          ],
        },
      },
    });
    expect(res.status(), await res.text()).toBe(201);
    const created = await res.json();
    expect(created.id).toBeTruthy();

    const list = await request.get(`${API}/workflows`);
    expect(list.ok(), await list.text()).toBeTruthy();
    const workflows = await list.json();
    const found = workflows.find((w: { id: string }) => w.id === created.id);
    expect(found).toBeTruthy();
    const graph = JSON.parse(found.graphJson);
    expect(graph.steps[0].type).toBe('team');
    expect(graph.steps[1].type).toBe('artifact');
  });

  test('POST /workflows persists parallel + synthesize steps', async ({ request }) => {
    const res = await request.post(`${API}/workflows`, {
      data: {
        name: `e2e-parallel-wf-${Date.now()}`,
        description: 'e2e parallel agent steps',
        graph: {
          steps: [
            {
              id: 'parallel1',
              type: 'parallel',
              steps: [
                { id: 'r1', type: 'agent', agentId: 'researcher', prompt: 'Find auth' },
                { id: 'r2', type: 'agent', agentId: 'reviewer', prompt: 'List risks' },
              ],
            },
            {
              id: 'merge',
              type: 'synthesize',
              fromStepIds: ['parallel1'],
              agentId: 'synthesizer',
            },
          ],
        },
      },
    });
    expect(res.status(), await res.text()).toBe(201);
    const created = await res.json();
    const list = await request.get(`${API}/workflows`);
    const workflows = await list.json();
    const found = workflows.find((w: { id: string }) => w.id === created.id);
    const graph = JSON.parse(found.graphJson);
    expect(graph.steps[0].type).toBe('parallel');
    expect(graph.steps[1].type).toBe('synthesize');
  });
});
