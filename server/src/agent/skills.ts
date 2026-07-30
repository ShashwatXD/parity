import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Skill = {
  name: string;
  description: string;
  triggers: string[];
  body: string;
  path: string;
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
  return skills;
}

/** Keyword-trigger skills for the current user message (always include empty-trigger skills). */
export function selectSkillsForMessage(userMessage: string): Skill[] {
  const hay = userMessage.toLowerCase();
  return listSkills().filter((s) => {
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
