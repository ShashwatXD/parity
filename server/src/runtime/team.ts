import { generateText } from 'ai';
import { AgentRepository } from '../repositories/agentRepository.js';
import { TeamRepository } from '../repositories/teamRepository.js';
import { ExecutionRepository } from '../repositories/executionRepository.js';
import { getModelForProfile } from '../llm/providers.js';
import { planTeamOrders, resolveAgentDef, runSubagent } from '../agent/subagent.js';
import type {
  HierarchicalTeamInput,
  HierarchicalTeamResult,
  WorkerResult,
} from './teamTypes.js';

function defaultWorkers() {
  return AgentRepository.list().filter(
    (a) => !['director', 'synthesizer'].includes(a.name.toLowerCase()),
  );
}

/**
 * Hierarchical team: director plans → workers execute (optionally parallel) → synthesizer merges.
 */
export async function runHierarchicalTeam(
  input: HierarchicalTeamInput,
): Promise<HierarchicalTeamResult> {
  AgentRepository.ensureDefaults();
  const maxLoops = Math.min(Math.max(input.maxLoops ?? 1, 1), 3);
  const parallel = input.parallel !== false;
  const state = TeamRepository.create({
    task: input.task,
    sessionId: input.sessionId,
    maxLoops,
  });

  const timelineRunId = input.runId ?? ExecutionRepository.startRun().runId;

  const director =
    (input.directorAgentId ? resolveAgentDef(input.directorAgentId) : undefined) ??
    AgentRepository.getByName('director');

  let workers = input.workerAgentIds?.length
    ? input.workerAgentIds
        .map((id) => resolveAgentDef(id))
        .filter((a): a is NonNullable<typeof a> => Boolean(a))
    : defaultWorkers();

  if (!workers.length) {
    workers = defaultWorkers();
  }

  ExecutionRepository.recordEvent({
    runId: timelineRunId,
    sessionId: input.sessionId,
    kind: 'team_start',
    label: 'Team run started',
    detail: {
      teamId: state.id,
      task: input.task,
      workers: workers.map((w) => w.name),
      maxLoops,
      parallel,
    },
  });

  const allResults: WorkerResult[] = [];
  let lastPlan = '';

  try {
    for (let loop = 0; loop < maxLoops; loop++) {
      state.loop = loop + 1;
      TeamRepository.save(state);

      const planned = await planTeamOrders({
        task:
          loop === 0
            ? input.task
            : `${input.task}\n\nPrevious results:\n${JSON.stringify(allResults, null, 2)}\n\nRefine remaining work.`,
        workers: workers.map((w) => ({
          id: w.id,
          name: w.name,
          description: w.description,
        })),
        profileId: director?.profileId || input.profileId,
        directorSystemPrompt: director?.systemPrompt,
      });

      lastPlan = planned.plan;
      state.directorPlan = planned.plan;
      TeamRepository.appendMessage(state, {
        from: director?.name ?? 'director',
        to: '*',
        content: planned.plan,
      });
      TeamRepository.setArtifact(state, `plan_loop_${loop + 1}`, planned.plan);
      TeamRepository.setArtifact(state, `orders_loop_${loop + 1}`, planned.orders);

      ExecutionRepository.recordEvent({
        runId: timelineRunId,
        sessionId: input.sessionId,
        kind: 'team_plan',
        label: `Director plan (loop ${loop + 1})`,
        detail: { plan: planned.plan, orders: planned.orders },
      });

      const sessionKey = input.sessionId ?? state.id;

      const runOrder = async (order: {
        agentId: string;
        goal: string;
      }): Promise<WorkerResult> => {
        const agent = resolveAgentDef(order.agentId);
        if (!agent) {
          return {
            agentId: order.agentId,
            agentName: order.agentId,
            goal: order.goal,
            text: '',
            steps: 0,
            ok: false,
            error: 'Agent not found',
          };
        }
        const started = Date.now();
        try {
          const result = await runSubagent({
            sessionId: `${sessionKey}:${agent.name}`,
            goal: order.goal,
            agentId: agent.id,
            profileId: agent.profileId || input.profileId,
            context: JSON.stringify({
              teamTask: input.task,
              plan: planned.plan,
              artifacts: state.artifacts,
            }),
          });
          TeamRepository.appendMessage(state, {
            from: agent.name,
            to: director?.name ?? 'director',
            content: result.text.slice(0, 4000),
          });
          ExecutionRepository.recordEvent({
            runId: timelineRunId,
            sessionId: input.sessionId,
            kind: 'team_worker',
            label: `${agent.name} completed`,
            detail: {
              goal: order.goal,
              steps: result.steps,
              preview: result.text.slice(0, 400),
            },
            latencyMs: Date.now() - started,
          });
          return {
            agentId: agent.id,
            agentName: agent.name,
            goal: order.goal,
            text: result.text,
            steps: result.steps,
            ok: true,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          ExecutionRepository.recordEvent({
            runId: timelineRunId,
            sessionId: input.sessionId,
            kind: 'team_worker',
            label: `${agent.name} failed`,
            detail: { goal: order.goal, message },
            status: 'error',
            latencyMs: Date.now() - started,
          });
          return {
            agentId: agent.id,
            agentName: agent.name,
            goal: order.goal,
            text: '',
            steps: 0,
            ok: false,
            error: message,
          };
        }
      };

      const loopResults = parallel
        ? await Promise.all(planned.orders.map((o) => runOrder(o)))
        : await planned.orders.reduce<Promise<WorkerResult[]>>(async (prev, o) => {
            const acc = await prev;
            acc.push(await runOrder(o));
            return acc;
          }, Promise.resolve([]));

      allResults.push(...loopResults);
      TeamRepository.setArtifact(state, `results_loop_${loop + 1}`, loopResults);
    }

    const synthesizer = AgentRepository.getByName('synthesizer');
    const synthProfile = synthesizer?.profileId || input.profileId;
    const active = getModelForProfile(synthProfile);
    const synth = await generateText({
      model: active.model,
      system:
        synthesizer?.systemPrompt ||
        'Synthesize multi-agent results into one clear final answer.',
      prompt: `Task: ${input.task}\n\nPlan: ${lastPlan}\n\nWorker results:\n${JSON.stringify(allResults, null, 2)}`,
      maxRetries: 1,
    });

    const synthesis = synth.text || '(empty synthesis)';
    TeamRepository.setArtifact(state, 'synthesis', synthesis);
    TeamRepository.appendMessage(state, {
      from: synthesizer?.name ?? 'synthesizer',
      to: 'user',
      content: synthesis.slice(0, 4000),
    });

    state.status = 'completed';
    TeamRepository.save(state);

    ExecutionRepository.recordEvent({
      runId: timelineRunId,
      sessionId: input.sessionId,
      kind: 'team_complete',
      label: 'Team run completed',
      detail: { teamId: state.id, workers: allResults.length },
    });

    return {
      teamId: state.id,
      status: state.status,
      plan: lastPlan,
      results: allResults,
      synthesis,
      state,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state.status = 'failed';
    TeamRepository.setArtifact(state, 'error', message);
    TeamRepository.save(state);
    ExecutionRepository.recordEvent({
      runId: timelineRunId,
      sessionId: input.sessionId,
      kind: 'team_error',
      label: 'Team run failed',
      detail: { message },
      status: 'error',
    });
    throw error;
  }
}

export function listTeams(limit?: number) {
  return TeamRepository.list(limit);
}

export function getTeam(id: string) {
  return TeamRepository.getById(id);
}
