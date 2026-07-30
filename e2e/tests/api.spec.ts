import { test, expect } from '@playwright/test';

const API = process.env.E2E_API_URL ?? 'http://127.0.0.1:5005/api';

/**
 * API-level E2E (no browser) — contract checks against the live Hono server.
 * Uses absolute URLs so we never hit the Next.js UI origin by mistake.
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
