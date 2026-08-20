import { sqlite } from '../db/database.js';
import { createId } from '../lib/ids.js';
import type { AgentDef, AgentDefInput, AgentToolAccess } from '../runtime/teamTypes.js';

const DEFAULT_AGENTS: Array<Omit<AgentDef, 'id' | 'createdAt' | 'updatedAt'>> = [
  {
    name: 'director',
    description: 'Plans work and delegates to specialist workers',
    systemPrompt:
      'You are the team director. Analyze the task, produce a short plan, and assign clear goals to named workers. Prefer parallel independent work. Be concise.',
    profileId: null,
    tools: 'none',
    maxSteps: 4,
  },
  {
    name: 'researcher',
    description: 'Explores the codebase and gathers evidence',
    systemPrompt:
      'You are a research agent. Search the workspace, gather facts, and return a compact evidence pack: paths, claims, open questions, summary. Do not edit files.',
    profileId: null,
    tools: 'workspace',
    maxSteps: 8,
  },
  {
    name: 'coder',
    description: 'Implements code changes in the workspace',
    systemPrompt:
      'You are a coding agent. Make focused edits to complete the assigned goal. Prefer small diffs. Summarize what you changed and any risks.',
    profileId: null,
    tools: 'workspace',
    maxSteps: 10,
  },
  {
    name: 'reviewer',
    description: 'Reviews outputs for bugs and gaps',
    systemPrompt:
      'You are a critical reviewer. Check the provided work for bugs, missing edge cases, and risks. Return findings ranked by severity, then a short verdict.',
    profileId: null,
    tools: 'workspace',
    maxSteps: 6,
  },
  {
    name: 'synthesizer',
    description: 'Merges parallel worker outputs into one answer',
    systemPrompt:
      'You synthesize multi-agent results into one clear final answer. Deduplicate, resolve conflicts, and structure as markdown when useful.',
    profileId: null,
    tools: 'none',
    maxSteps: 4,
  },
];

function rowToAgent(row: Record<string, unknown>): AgentDef {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description ?? ''),
    systemPrompt: String(row.system_prompt ?? row.systemPrompt ?? ''),
    profileId: (row.profile_id ?? row.profileId ?? null) as string | null,
    tools: String(row.tools ?? 'workspace') as AgentToolAccess,
    maxSteps: Number(row.max_steps ?? row.maxSteps ?? 8),
    createdAt: Number(row.created_at ?? row.createdAt),
    updatedAt: Number(row.updated_at ?? row.updatedAt),
  };
}

export const AgentRepository = {
  ensureDefaults() {
    const count = sqlite.prepare(`SELECT COUNT(*) as n FROM agent_defs`).get() as { n: number };
    if (count.n > 0) return;
    const now = Date.now();
    const insert = sqlite.prepare(
      `INSERT INTO agent_defs (id, name, description, system_prompt, profile_id, tools, max_steps, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const a of DEFAULT_AGENTS) {
      insert.run(
        createId('agent'),
        a.name,
        a.description,
        a.systemPrompt,
        a.profileId,
        a.tools,
        a.maxSteps,
        now,
        now,
      );
    }
  },

  list(): AgentDef[] {
    this.ensureDefaults();
    return (
      sqlite
        .prepare(
          `SELECT id, name, description, system_prompt, profile_id, tools, max_steps, created_at, updated_at
           FROM agent_defs ORDER BY name ASC`,
        )
        .all() as Record<string, unknown>[]
    ).map(rowToAgent);
  },

  getById(id: string): AgentDef | undefined {
    this.ensureDefaults();
    const row = sqlite
      .prepare(
        `SELECT id, name, description, system_prompt, profile_id, tools, max_steps, created_at, updated_at
         FROM agent_defs WHERE id = ?`,
      )
      .get(id) as Record<string, unknown> | undefined;
    return row ? rowToAgent(row) : undefined;
  },

  getByName(name: string): AgentDef | undefined {
    this.ensureDefaults();
    const row = sqlite
      .prepare(
        `SELECT id, name, description, system_prompt, profile_id, tools, max_steps, created_at, updated_at
         FROM agent_defs WHERE lower(name) = lower(?)`,
      )
      .get(name) as Record<string, unknown> | undefined;
    return row ? rowToAgent(row) : undefined;
  },

  create(input: AgentDefInput): AgentDef {
    this.ensureDefaults();
    const now = Date.now();
    const row: AgentDef = {
      id: createId('agent'),
      name: input.name.trim(),
      description: input.description ?? '',
      systemPrompt: input.systemPrompt,
      profileId: input.profileId ?? null,
      tools: input.tools ?? 'workspace',
      maxSteps: input.maxSteps ?? 8,
      createdAt: now,
      updatedAt: now,
    };
    sqlite
      .prepare(
        `INSERT INTO agent_defs (id, name, description, system_prompt, profile_id, tools, max_steps, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.name,
        row.description,
        row.systemPrompt,
        row.profileId,
        row.tools,
        row.maxSteps,
        row.createdAt,
        row.updatedAt,
      );
    return row;
  },

  update(id: string, patch: Partial<AgentDefInput>): AgentDef | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;
    const next: AgentDef = {
      ...existing,
      name: patch.name?.trim() ?? existing.name,
      description: patch.description ?? existing.description,
      systemPrompt: patch.systemPrompt ?? existing.systemPrompt,
      profileId: patch.profileId !== undefined ? patch.profileId : existing.profileId,
      tools: patch.tools ?? existing.tools,
      maxSteps: patch.maxSteps ?? existing.maxSteps,
      updatedAt: Date.now(),
    };
    sqlite
      .prepare(
        `UPDATE agent_defs SET name = ?, description = ?, system_prompt = ?, profile_id = ?, tools = ?, max_steps = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        next.name,
        next.description,
        next.systemPrompt,
        next.profileId,
        next.tools,
        next.maxSteps,
        next.updatedAt,
        id,
      );
    return next;
  },

  delete(id: string): boolean {
    const result = sqlite.prepare(`DELETE FROM agent_defs WHERE id = ?`).run(id);
    return Number(result.changes) > 0;
  },
};
