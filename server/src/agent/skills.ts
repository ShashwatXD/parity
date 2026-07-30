import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSettings } from '../runtime/settings.js';

export type Skill = {
  name: string;
  description: string;
  triggers: string[];
  body: string;
  path: string;
};

export type SkillInfo = {
  name: string;
  description: string;
  triggers: string[];
  body: string;
  enabled: boolean;
};

export type SkillDraft = {
  name: string;
  description?: string;
  triggers?: string[];
  body: string;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillsDir = join(__dirname, '../../skills');

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  if (!raw.startsWith('---')) return { meta: {}, body: raw };
  const end = raw.indexOf('\n---', 3);
  if (end < 0) return { meta: {}, body: raw };
  const fm = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).trim();
  const meta: Record<string, string> = {};
  for (const line of fm.split('\n')) {
    const m = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (m) meta[m[1]!] = m[2]!.replace(/^["']|["']$/g, '').trim();
  }
  return { meta, body };
}

export function sanitizeSkillName(input: string): string {
  const name = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  if (!name) throw new Error('Skill name is required');
  return name;
}

function toSkillPath(name: string): string {
  return join(skillsDir, `${sanitizeSkillName(name)}.md`);
}

function serializeSkill(draft: SkillDraft): string {
  const name = sanitizeSkillName(draft.name);
  const description = (draft.description ?? '').trim().replace(/"/g, "'");
  const triggers = (draft.triggers ?? [])
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .join(', ');
  const body = draft.body.trim();
  if (!body) throw new Error('Skill body is required');
  return [
    '---',
    `name: ${name}`,
    `description: ${description || name}`,
    `triggers: ${triggers}`,
    '---',
    '',
    body,
    '',
  ].join('\n');
}

export function listSkills(): Skill[] {
  if (!existsSync(skillsDir)) return [];
  const files = readdirSync(skillsDir).filter((f) => f.endsWith('.md'));
  const skills: Skill[] = [];
  for (const file of files) {
    const path = join(skillsDir, file);
    const raw = readFileSync(path, 'utf8');
    const { meta, body } = parseFrontmatter(raw);
    const name = meta.name || file.replace(/\.md$/, '');
    const triggers = (meta.triggers || '')
      .split(/[,|]/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    skills.push({
      name,
      description: meta.description || body.slice(0, 120),
      triggers,
      body,
      path,
    });
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export function getDisabledSkillNames(): Set<string> {
  return new Set(getSettings().disabledSkills ?? []);
}

export function listSkillInfos(): SkillInfo[] {
  const disabled = getDisabledSkillNames();
  return listSkills().map((s) => ({
    name: s.name,
    description: s.description,
    triggers: s.triggers,
    body: s.body,
    enabled: !disabled.has(s.name),
  }));
}

export function writeSkill(draft: SkillDraft, opts?: { overwrite?: boolean }): SkillInfo {
  mkdirSync(skillsDir, { recursive: true });
  const name = sanitizeSkillName(draft.name);
  const path = toSkillPath(name);
  if (!opts?.overwrite && existsSync(path)) {
    throw new Error(`Skill already exists: ${name}`);
  }
  writeFileSync(path, serializeSkill({ ...draft, name }), 'utf8');
  const info = listSkillInfos().find((s) => s.name === name);
  if (!info) throw new Error('Failed to read skill after write');
  return info;
}

export function deleteSkill(name: string): void {
  const path = toSkillPath(name);
  if (!existsSync(path)) throw new Error(`Skill not found: ${name}`);
  unlinkSync(path);
}

/** Keyword-trigger skills for the current user message (respects Settings enable/disable). */
export function selectSkillsForMessage(userMessage: string): Skill[] {
  const hay = userMessage.toLowerCase();
  const disabled = getDisabledSkillNames();
  return listSkills().filter((s) => {
    if (disabled.has(s.name)) return false;
    if (!s.triggers.length) return true;
    return s.triggers.some((t) => hay.includes(t));
  });
}

export function formatSkillsForPrompt(skills: Skill[]): string {
  if (!skills.length) return '';
  return [
    '## Active skills',
    'Follow these skill playbooks when relevant:',
    ...skills.map((s) => `### Skill: ${s.name}\n${s.body}`),
  ].join('\n\n');
}
