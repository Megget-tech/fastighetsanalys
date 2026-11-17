import { randomUUID } from 'crypto';
import fs from 'fs/promises';

/**
 * Analysjobb i minnet. En analys tar 1–15 minuter, så i stället för att hålla ett HTTP-anrop öppet
 * startas den som ett jobb och frontend frågar efter status (GET /api/analysis/jobs/:id).
 *
 * Jobben lever i processens minne: en omstart av tjänsten tappar pågående jobb (frontend får 404
 * och visar ett fel). Det räcker för en instans; vid flera instanser behövs en delad kö.
 */

export type JobStatus = 'running' | 'done' | 'error';
export type JobKind = 'quick' | 'full';

export interface AnalysisJob {
  id: string;
  kind: JobKind;
  status: JobStatus;
  startedAt: number;
  finishedAt?: number;
  /** Svaret som frontend visar (samma form som de gamla synkrona endpointsen gav). */
  result?: any;
  error?: string;
  /** Filer jobbet får servera, nyckel → absolut sökväg. Bara dessa kan hämtas. */
  files: Record<string, string>;
  /** Kataloger/filer som tas bort när jobbet städas. */
  cleanup: string[];
}

const jobs = new Map<string, AnalysisJob>();

const MAX_RUNNING = parseInt(process.env.ANALYSIS_MAX_RUNNING || '2', 10);
const JOB_TTL_MS = parseInt(process.env.ANALYSIS_JOB_TTL_HOURS || '6', 10) * 3600 * 1000;

export function runningCount(): number {
  let n = 0;
  for (const j of jobs.values()) if (j.status === 'running') n++;
  return n;
}

export function canStartJob(): boolean {
  return runningCount() < MAX_RUNNING;
}

export function getJob(id: string): AnalysisJob | undefined {
  return jobs.get(id);
}

/**
 * Starta ett jobb. `work` körs i bakgrunden och ska returnera svaret, filerna och vad som ska städas.
 */
export function startJob(
  kind: JobKind,
  work: () => Promise<{ ok: boolean; result: any; error?: string; files: Record<string, string>; cleanup: string[] }>,
  extraCleanup: string[] = []
): AnalysisJob {
  const job: AnalysisJob = {
    id: randomUUID(),
    kind,
    status: 'running',
    startedAt: Date.now(),
    files: {},
    cleanup: [...extraCleanup],
  };
  jobs.set(job.id, job);

  work()
    .then(({ ok, result, error, files, cleanup }) => {
      job.status = ok ? 'done' : 'error';
      job.result = result;
      job.error = error;
      job.files = files;
      job.cleanup.push(...cleanup);
    })
    .catch((err: any) => {
      job.status = 'error';
      job.error = err?.message || String(err);
    })
    .finally(() => {
      job.finishedAt = Date.now();
      console.log(`[Jobs] ${job.kind} ${job.id} ${job.status} efter ${Math.round((job.finishedAt - job.startedAt) / 1000)} s`);
    });

  return job;
}

async function removeJob(job: AnalysisJob) {
  jobs.delete(job.id);
  for (const p of job.cleanup) {
    await fs.rm(p, { recursive: true, force: true }).catch(() => {});
  }
}

// Städa färdiga jobb (och deras temporära filer) efter JOB_TTL
setInterval(() => {
  const now = Date.now();
  for (const job of jobs.values()) {
    if (job.status !== 'running' && job.finishedAt && now - job.finishedAt > JOB_TTL_MS) {
      removeJob(job);
    }
  }
}, 10 * 60 * 1000).unref();
