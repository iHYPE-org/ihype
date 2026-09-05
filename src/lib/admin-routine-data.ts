import { kvGet } from '@/lib/kv';
import { readRuntimeEnv } from '@/lib/runtime-env';
import { evaluateRestoreDrill } from '@/lib/alpha-readiness';
import type { WorkbenchQueue } from '@/lib/admin-workbench';
import { AUTOMATED_JOBS, buildRoutineBoard, type LivenessRead, type RoutineBoard } from '@/lib/admin-routine';

/**
 * The reads behind the routine board — split from `admin-routine.ts` for the
 * same reason every other admin board is split: the catalogue stays loadable
 * by the unit suite and a client component, and a KV or env import anywhere in
 * that graph ends both.
 *
 * Liveness comes from the `cron-alive:<job>` keys `pingCronAlive()` already
 * writes with a TTL of two days (eight for weekly jobs, thirty minutes for the
 * notification worker). An absent key therefore means "no run inside that
 * window", which is a finding; a failed read means nothing at all, and the two
 * are kept apart because a board that prints "never ran" over a KV outage
 * sends someone to debug a job that is fine.
 */
async function readLiveness(key: string): Promise<LivenessRead> {
  try {
    const at = await kvGet<number>(`cron-alive:${key}`);
    if (typeof at === 'number' && Number.isFinite(at)) return { kind: 'ran', at };
    if (typeof at === 'string' && Number.isFinite(Number(at))) return { kind: 'ran', at: Number(at) };
    return { kind: 'stale' };
  } catch {
    return { kind: 'unknown' };
  }
}

export async function getRoutineBoard(queues: WorkbenchQueue[]): Promise<RoutineBoard> {
  const keys = AUTOMATED_JOBS.map((job) => job.aliveKey).filter((k): k is string => Boolean(k));
  const reads = await Promise.all(keys.map(async (key) => [key, await readLiveness(key)] as const));

  let restoreDrill: ReturnType<typeof evaluateRestoreDrill> | null;
  try {
    restoreDrill = evaluateRestoreDrill(readRuntimeEnv('RESTORE_DRILL_VERIFIED_AT'));
  } catch {
    restoreDrill = null;
  }

  return buildRoutineBoard({
    queues,
    liveness: Object.fromEntries(reads),
    restoreDrill,
  });
}
