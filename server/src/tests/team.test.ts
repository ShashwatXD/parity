import assert from 'node:assert/strict';
import test from 'node:test';
import { migrate, sqlite } from '../db/database.js';
import { AgentRepository } from '../repositories/agentRepository.js';
import { TeamRepository } from '../repositories/teamRepository.js';
import { createWorkflow, listWorkflows } from '../runtime/workflows.js';

migrate();

test('agent defaults seed researcher/coder/director', () => {
  const agents = AgentRepository.list();
  const names = agents.map((a) => a.name);
  for (const required of ['director', 'researcher', 'coder', 'reviewer', 'synthesizer']) {
    assert.ok(names.includes(required), `missing ${required}`);
  }
});

test('agent create + get by name', () => {
  const created = AgentRepository.create({
    name: `custom_${Date.now()}`,
    description: 'test agent',
    systemPrompt: 'Be helpful',
    tools: 'none',
    maxSteps: 3,
  });
  const found = AgentRepository.getByName(created.name);
  assert.equal(found?.id, created.id);
  assert.equal(found?.tools, 'none');
});

test('team state blackboard persists messages and artifacts', () => {
  const state = TeamRepository.create({ task: 'demo task', maxLoops: 2 });
  TeamRepository.appendMessage(state, { from: 'director', to: '*', content: 'plan' });
  TeamRepository.setArtifact(state, 'plan', 'do X then Y');
  const loaded = TeamRepository.getById(state.id);
  assert.ok(loaded);
  assert.equal(loaded!.messages.length, 1);
  assert.equal(loaded!.artifacts.plan, 'do X then Y');
  assert.equal(loaded!.maxLoops, 2);
});

test('workflow graph accepts team + parallel step metadata', () => {
  const wf = createWorkflow({
    name: 'team-graph',
    description: 'multi-agent orchestration',
    graph: {
      steps: [
        {
          id: 'parallel1',
          type: 'parallel',
          steps: [
            { id: 'r1', type: 'agent', agentId: 'researcher', prompt: 'Find auth code' },
            { id: 'r2', type: 'agent', agentId: 'reviewer', prompt: 'List risks' },
          ],
        },
        {
          id: 'merge',
          type: 'synthesize',
          fromStepIds: ['parallel1'],
          agentId: 'synthesizer',
        },
        {
          id: 'team1',
          type: 'team',
          task: 'Ship a safer session design',
          maxLoops: 1,
          parallel: true,
        },
      ],
    },
  });
  const listed = listWorkflows() as Array<{ id: string; graphJson: string }>;
  const found = listed.find((w) => w.id === wf.id);
  assert.ok(found);
  const graph = JSON.parse(found!.graphJson) as {
    steps: Array<{ type: string }>;
  };
  assert.equal(graph.steps[0]?.type, 'parallel');
  assert.equal(graph.steps[2]?.type, 'team');
});

test('sqlite has agent_defs and team_runs', () => {
  const tables = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
    .all() as Array<{ name: string }>;
  const names = tables.map((t) => t.name);
  assert.ok(names.includes('agent_defs'));
  assert.ok(names.includes('team_runs'));
});
