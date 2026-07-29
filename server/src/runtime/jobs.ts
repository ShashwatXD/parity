import { JobRepository } from '../repositories/jobRepository.js';
import { runWorkflow } from './workflows.js';

let ticking = false;

export function enqueueJob(kind: string, payload: unknown) {
  const job = JobRepository.enqueue(kind, payload);
  void processQueue();
  return { id: job.id, kind: job.kind, status: job.status };
}

export function listJobs() {
  return JobRepository.list();
}

async function processQueue() {
  if (ticking) return;
  ticking = true;
  try {
    while (true) {
      const job = JobRepository.nextQueued();
      if (!job) break;
      JobRepository.markRunning(job.id);
      try {
        const payload = JSON.parse(job.payloadJson) as Record<string, unknown>;
        let result: unknown = null;
        if (job.kind === 'workflow') {
          result = await runWorkflow(
            String(payload.workflowId),
            (payload.input as Record<string, unknown>) ?? {},
          );
        } else {
          throw new Error(`Unknown job kind: ${job.kind}`);
        }
        JobRepository.markCompleted(job.id, result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        JobRepository.markFailed(job.id, message);
      }
    }
  } finally {
    ticking = false;
  }
}

export function startJobWorker() {
  setInterval(() => {
    void processQueue();
  }, 2000);
}
