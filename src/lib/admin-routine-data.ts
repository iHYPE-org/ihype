import { kvGet } from '@/lib/kv';
import { readRuntimeEnv } from '@/lib/runtime-env';
import { evaluateRestoreDrill, parseAutomatedDrillAt } from '@/lib/alpha-readiness';
import type { WorkbenchQueue } from '@/lib/admin-workbench';
import { AUTOMATED_JOBS, SCHEDULED_WORKFLOWS, buildRoutineBoard, type LivenessRead, type RoutineBoard } from '@/lib/admin-routine';

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
  /* Jobs AND the scheduled workflows that write a key of their own (the
     nightly, the restore drill) — one read per key, the same reader. */
  const keys = [
    ...AUTOMATED_JOBS.map((job) => job.aliveKey),
    ...SCHEDULED_WORKFLOWS.map((wf) => wf.aliveKey),
  ].filter((k): k is string => Boolean(k));
  const reads = await Promise.all(keys.map(async (key) => [key, await readLiveness(key)] as const));

  let restoreDrill: ReturnType<typeof evaluateRestoreDrill> | null;
  try {
    /* The nightly drill's pass is restore evidence too: the duty reads clear
       when the machine did it last night, and the operator's own stamp still
       counts for the month it covers. */
    const automated = reads.find(([key]) => key === 'restore-drill')?.[1];
    const automatedAt = automated?.kind === 'ran' ? parseAutomatedDrillAt(automated.at) : null;
    restoreDrill = evaluateRestoreDrill(readRuntimeEnv('RESTORE_DRILL_VERIFIED_AT'), Date.now(), automatedAt);
  } catch {
    restoreDrill = null;
  }

  return buildRoutineBoard({
    queues,
    liveness: Object.fromEntries(reads),
    restoreDrill,
  });
}
