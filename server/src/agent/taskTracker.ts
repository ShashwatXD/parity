export type TaskItem = {
  id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
  notes?: string;
};

const plans = new Map<string, TaskItem[]>();

export function viewPlan(sessionId: string): TaskItem[] {
  return plans.get(sessionId) ?? [];
}

export function setPlan(sessionId: string, tasks: TaskItem[]): TaskItem[] {
  const normalized = tasks.map((t, i) => ({
    id: t.id || `t${i + 1}`,
    title: t.title.trim(),
    status: t.status ?? 'todo',
    notes: t.notes,
  }));
  plans.set(sessionId, normalized);
  return normalized;
}

export function upsertTask(
  sessionId: string,
  task: Partial<TaskItem> & { title?: string; id?: string },
): TaskItem[] {
  const current = viewPlan(sessionId);
  if (task.id) {
    const idx = current.findIndex((t) => t.id === task.id);
    if (idx >= 0) {
      current[idx] = { ...current[idx]!, ...task, title: task.title?.trim() || current[idx]!.title };
      plans.set(sessionId, current);
      return current;
    }
  }
  const created: TaskItem = {
    id: task.id || `t${current.length + 1}`,
    title: (task.title ?? 'Untitled').trim(),
    status: task.status ?? 'todo',
    notes: task.notes,
  };
  current.push(created);
  plans.set(sessionId, current);
  return current;
}

export function formatPlanMarkdown(sessionId: string): string {
  const tasks = viewPlan(sessionId);
  if (!tasks.length) return 'No tasks yet. Use task_tracker with command=plan to create a plan.';
  return tasks
    .map((t) => {
      const mark =
        t.status === 'done' ? 'x' : t.status === 'in_progress' ? '~' : t.status === 'cancelled' ? '-' : ' ';
      return `- [${mark}] (${t.id}) ${t.title}${t.notes ? ` — ${t.notes}` : ''} [${t.status}]`;
    })
    .join('\n');
}
