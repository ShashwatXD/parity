import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import {
  listWorkspaceTree,
  readWorkspaceFile,
  strReplaceInFile,
  writeWorkspaceFile,
} from '../workspace/files.js';
import { gitDiff, gitStatus } from '../workspace/git.js';
import { getWorkspaceRoot } from '../workspace/paths.js';
import { globWorkspace, grepWorkspace } from '../workspace/search.js';
import { runInWorkspace } from '../workspace/terminal.js';
import { formatPlanMarkdown, setPlan, upsertTask, viewPlan } from './taskTracker.js';

function ok(data: unknown) {
  return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return `ERROR: ${message}`;
}

export function buildWorkspaceTools(sessionId: string): ToolSet {
  return {
    file_editor: tool({
      description:
        'Read, create, or edit files inside the Parity workspace. Prefer str_replace for surgical edits.',
      inputSchema: z.object({
        command: z.enum(['view', 'create', 'str_replace', 'write']),
        path: z.string().describe('Workspace-relative path'),
        content: z.string().optional().describe('Full file content for create/write'),
        old_str: z.string().optional().describe('Exact string to replace (str_replace)'),
        new_str: z.string().optional().describe('Replacement string (str_replace)'),
      }),
      execute: async (args) => {
        try {
          if (args.command === 'view') {
            return ok(readWorkspaceFile(args.path));
          }
          if (args.command === 'create' || args.command === 'write') {
            if (args.content == null) throw new Error('content is required');
            return ok(writeWorkspaceFile(args.path, args.content));
          }
          if (args.command === 'str_replace') {
            if (args.old_str == null || args.new_str == null) {
              throw new Error('old_str and new_str are required');
            }
            return ok(strReplaceInFile(args.path, args.old_str, args.new_str));
          }
          throw new Error(`Unknown command ${args.command}`);
        } catch (e) {
          return fail(e);
        }
      },
    }),

    terminal: tool({
      description:
        'Run a shell command in the workspace root (zsh -lc). Use for builds, tests, git, package managers.',
      inputSchema: z.object({
        command: z.string(),
        timeout_ms: z.number().int().min(1000).max(120_000).optional(),
      }),
      execute: async (args) => {
        try {
          const entry = await runInWorkspace({
            command: args.command,
            timeoutMs: args.timeout_ms,
          });
          return ok({
            exitCode: entry.exitCode,
            timedOut: entry.timedOut,
            durationMs: entry.durationMs,
            stdout: entry.stdout,
            stderr: entry.stderr,
            cwd: entry.cwd,
          });
        } catch (e) {
          return fail(e);
        }
      },
    }),

    glob: tool({
      description: 'Find files in the workspace by glob pattern (supports * and **).',
      inputSchema: z.object({
        pattern: z.string(),
        limit: z.number().int().min(1).max(500).optional(),
      }),
      execute: async (args) => {
        try {
          return ok(globWorkspace(args.pattern, args.limit));
        } catch (e) {
          return fail(e);
        }
      },
    }),

    grep: tool({
      description: 'Search file contents in the workspace with a regex.',
      inputSchema: z.object({
        pattern: z.string(),
        glob: z.string().optional(),
        case_insensitive: z.boolean().optional(),
        max_matches: z.number().int().min(1).max(200).optional(),
      }),
      execute: async (args) => {
        try {
          return ok(
            grepWorkspace({
              pattern: args.pattern,
              glob: args.glob,
              caseInsensitive: args.case_insensitive,
              maxMatches: args.max_matches,
            }),
          );
        } catch (e) {
          return fail(e);
        }
      },
    }),

    git_status: tool({
      description: 'Show git status and optional diff for the workspace.',
      inputSchema: z.object({
        include_diff: z.boolean().optional(),
        staged: z.boolean().optional(),
      }),
      execute: async (args) => {
        try {
          const status = await gitStatus();
          if (!args.include_diff) return ok(status);
          const diff = await gitDiff(Boolean(args.staged));
          return ok({ ...status, ...diff });
        } catch (e) {
          return fail(e);
        }
      },
    }),

    list_dir: tool({
      description: 'List a directory tree inside the workspace.',
      inputSchema: z.object({
        path: z.string().optional().default('.'),
        depth: z.number().int().min(0).max(6).optional().default(2),
      }),
      execute: async (args) => {
        try {
          return ok({
            root: getWorkspaceRoot(),
            tree: listWorkspaceTree(args.path ?? '.', args.depth ?? 2),
          });
        } catch (e) {
          return fail(e);
        }
      },
    }),

    task_tracker: tool({
      description:
        'Long-horizon planner. Use command=view to see the plan, command=plan to replace the plan, command=update to upsert one task. Keep plans short and actionable.',
      inputSchema: z.object({
        command: z.enum(['view', 'plan', 'update']),
        tasks: z
          .array(
            z.object({
              id: z.string().optional(),
              title: z.string(),
              status: z.enum(['todo', 'in_progress', 'done', 'cancelled']).optional(),
              notes: z.string().optional(),
            }),
          )
          .optional(),
        task: z
          .object({
            id: z.string().optional(),
            title: z.string().optional(),
            status: z.enum(['todo', 'in_progress', 'done', 'cancelled']).optional(),
            notes: z.string().optional(),
          })
          .optional(),
      }),
      execute: async (args) => {
        try {
          if (args.command === 'view') {
            return ok({ tasks: viewPlan(sessionId), markdown: formatPlanMarkdown(sessionId) });
          }
          if (args.command === 'plan') {
            if (!args.tasks?.length) throw new Error('tasks required for plan');
            const tasks = setPlan(
              sessionId,
              args.tasks.map((t) => ({
                id: t.id || '',
                title: t.title,
                status: t.status ?? 'todo',
                notes: t.notes,
              })),
            );
            return ok({ tasks, markdown: formatPlanMarkdown(sessionId) });
          }
          if (args.command === 'update') {
            if (!args.task) throw new Error('task required for update');
            const tasks = upsertTask(sessionId, args.task);
            return ok({ tasks, markdown: formatPlanMarkdown(sessionId) });
          }
          throw new Error(`Unknown command ${args.command}`);
        } catch (e) {
          return fail(e);
        }
      },
    }),
  };
}
