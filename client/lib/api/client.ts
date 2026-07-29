import { API_BASE_URL } from '../constants';
import type { ApiErrorBody } from '../models';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function parseError(res: Response): Promise<never> {
  const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
  throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`);
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`);
  if (!res.ok) await parseError(res);
  return res.json() as Promise<T>;
}

export async function apiSend<T>(
  path: string,
  init: {
    method: 'POST' | 'DELETE';
    body?: unknown;
  },
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: init.method,
    headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) await parseError(res);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiStream(
  path: string,
  body: unknown,
): Promise<Response> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) await parseError(res);
  return res;
}
