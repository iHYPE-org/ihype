import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  AUTOMATED_JOBS,
  OPERATOR_DUTIES,
  SCHEDULED_WORKFLOWS,
  buildRoutineBoard,
  cadenceForQueue,
  cadenceForSchedule,
  describeSchedule,
  dutiesFor,
  routineHeadline,
} from '@/lib/admin-routine';
import type { WorkbenchQueue } from '@/lib/admin-workbench';

function q(over: Partial<WorkbenchQueue> & { id: string }): WorkbenchQueue {
  return {
    label: over.id,
    detail: '',
    href: `/admin/${over.id}`,
    count: 0,
    oldestHours: null,
    slaHours: null,
    overdue: false,
    ...over,
  };
}

describe('cadenceForQueue', () => {
  it('checks a promise of four days or less every day, and anything looser once a week', () => {
    expect(cadenceForQueue(24)).toBe('daily');
    expect(cadenceForQueue(48)).toBe('daily');
    expect(cadenceForQueue(72)).toBe('daily');
    expect(cadenceForQueue(96)).toBe('daily');
    expect(cadenceForQueue(168)).toBe('weekly');
    // No promise at all is not "no attention": it is the weekly look.
    expect(cadenceForQueue(null)).toBe('weekly');
  });
});

describe('describeSchedule', () => {
  it('says the handful of shapes this repository uses in words', () => {
    expect(describeSchedule('*/5 * * * *')).toBe('every 5 min');
    expect(describeSchedule('*/15 * * * *')).toBe('every 15 min');
    expect(describeSchedule('0 * * * *')).toBe('hourly');
    expect(describeSchedule('0 */6 * * *')).toBe('every 6 h');
    expect(describeSchedule('0 13 * * *')).toBe('daily 13:00 UTC');
    expect(describeSchedule('30 3 * * *')).toBe('daily 03:30 UTC');
    expect(describeSchedule('0 9 * * 1')).toBe('Mon 09:00 UTC');
    expect(describeSchedule('30 8 * * 1')).toBe('Mon 08:30 UTC');
    expect(describeSchedule('0 9 1 * *')).toBe('1st of the month, 09:00 UTC');
    expect(describeSchedule('0 0,6,12,18 * * *')).toBe('daily at 00, 06, 12, 18:00 UTC');
  });

  it('returns a shape it does not understand verbatim rather than guessing', () => {
    // A wrong sentence about when money moves is worse than the expression.
    expect(describeSchedule('0 9 * 3 *')).toBe('0 9 * 3 *');
    expect(describeSchedule('nonsense')).toBe('nonsense');
  });

  it('describes every job and workflow in the catalogue', () => {
    for (const job of AUTOMATED_JOBS) {
      expect(describeSchedule(job.schedule), job.path).not.toBe(job.schedule);
    }
    for (const wf of SCHEDULED_WORKFLOWS) {
      expect(describeSchedule(wf.schedule), wf.file).not.toBe(wf.schedule);
    }
  });
});

describe('cadenceForSchedule', () => {
  it('groups by how often, from the expression alone', () => {
    expect(cadenceForSchedule('*/5 * * * *')).toBe('continuous');
    expect(cadenceForSchedule('0 * * * *')).toBe('continuous');
    expect(cadenceForSchedule('0 */6 * * *')).toBe('continuous');
    expect(cadenceForSchedule('0 13 * * *')).toBe('daily');
    expect(cadenceForSchedule('0 9 * * 1')).toBe('weekly');
    expect(cadenceForSchedule('0 9 1 * *')).toBe('monthly');
  });
});

/**
 * The two copies of the schedule. `workers/cron.ts` is bundled on its own and
 * deliberately imports nothing from `src/`, so this board restates its table;
 * these tests are what make the restatement safe. Same regex as
 * `wiring-guards.test.ts`, so both read the dispatcher the same way.
 */
describe('AUTOMATED_JOBS against workers/cron.ts', () => {
  const dispatcher = readFileSync('workers/cron.ts', 'utf8');
  const dispatched = [...dispatcher.matchAll(/path:\s*'([^']+)'\s*,\s*schedule:\s*'([^']+)'/g)]
    .map((m) => `${m[1]} @ ${m[2]}`);
  const described = AUTOMATED_JOBS.map((j) => `${j.path} @ ${j.schedule}`);

  it('parses a non-empty dispatcher table, so a format change fails here rather than passing vacuously', () => {
    expect(dispatched.length).toBeGreaterThan(20);
  });

  it('describes every dispatched job, at the schedule it really fires on', () => {
    expect(dispatched.filter((entry) => !described.includes(entry)),
      'these jobs run and the routine board would not show them — add them to AUTOMATED_JOBS').toEqual([]);
  });

  it('describes no job the dispatcher no longer runs', () => {
    expect(described.filter((entry) => !dispatched.includes(entry)),
      'the board would tell an operator these run, and they do not').toEqual([]);
  });

  it('names a liveness key only for a job that actually writes one', () => {
    // Every pingCronAlive('name') in the cron routes. A key named here that no
    // job writes would read "no recent run" forever and send someone to debug a
    // job that is fine.
    const routes = ['src/app/api/cron/route.ts', 'src/app/api/cron/notification-jobs/route.ts']
      .map((f) => readFileSync(f, 'utf8')).join('\n');
    const written = new Set([...routes.matchAll(/pingCronAlive\('([^']+)'/g)].map((m) => m[1]));
    expect(written.size).toBeGreaterThan(10);
    const orphan = AUTOMATED_JOBS.filter((j) => j.aliveKey && !written.has(j.aliveKey)).map((j) => j.aliveKey);
    expect(orphan).toEqual([]);
    // And the other way: a job that records liveness should show it.
    const tracked = new Set(AUTOMATED_JOBS.map((j) => j.aliveKey).filter(Boolean));
    expect([...written].filter((k) => !tracked.has(k)),
      'these jobs record a run and the board would say "not tracked"').toEqual([]);
  });

  it('describes each job in the operator’s terms, not the route’s', () => {
    for (const job of AUTOMATED_JOBS) {
      expect(job.label.length, job.path).toBeGreaterThan(3);
      expect(job.what.length, job.path).toBeGreaterThan(10);
    }
  });
});

describe('SCHEDULED_WORKFLOWS against .github/workflows', () => {
  it('quotes each workflow’s real cron', () => {
    for (const wf of SCHEDULED_WORKFLOWS) {
      const yml = readFileSync(`.github/workflows/${wf.file}`, 'utf8');
      const crons = [...yml.matchAll(/^\s*-\s*cron:\s*'([^']+)'/gm)].map((m) => m[1]);
      expect(crons, wf.file).toContain(wf.schedule);
    }
  });

  it('lists every workflow that has a schedule', () => {
    const { readdirSync } = require('node:fs') as typeof import('node:fs');
    const scheduled = readdirSync('.github/workflows')
      .filter((f) => /\.ya?ml$/.test(f))
      .filter((f) => /^\s*schedule:/m.test(readFileSync(`.github/workflows/${f}`, 'utf8')));
    expect(scheduled.sort()).toEqual(SCHEDULED_WORKFLOWS.map((wf) => wf.file).sort());
  });
});

describe('buildRoutineBoard', () => {
  const queues = [
    q({ id: 'payouts', slaHours: 24, count: 2, oldestHours: 30, overdue: true }),
    q({ id: 'verifications', slaHours: 48 }),
    q({ id: 'support', slaHours: 168, count: 1, oldestHours: 3 }),
    q({ id: 'feedback', slaHours: null }),
  ];

  it('files each queue under the cadence its own promise implies', () => {
    const board = buildRoutineBoard({ queues, liveness: {}, restoreDrill: null });
    expect(dutiesFor(board, 'daily').filter((d) => d.queueId).map((d) => d.queueId)).toEqual(['payouts', 'verifications']);
    expect(dutiesFor(board, 'weekly').filter((d) => d.queueId).map((d) => d.queueId)).toEqual(['support', 'feedback']);
  });

  it('puts what needs a person above what is only to be read, and clear queues last', () => {
    const board = buildRoutineBoard({ queues, liveness: {}, restoreDrill: null });
    const daily = dutiesFor(board, 'daily').map((d) => d.status);
    expect(daily[0]).toBe('overdue');
    expect(daily[daily.length - 1]).toBe('clear');
    expect(daily.indexOf('info')).toBeLessThan(daily.indexOf('clear'));
  });

  it('carries the live count and the promise into the row', () => {
    const board = buildRoutineBoard({ queues, liveness: {}, restoreDrill: null });
    const payouts = board.duties.find((d) => d.queueId === 'payouts');
    expect(payouts?.count).toBe(2);
    expect(payouts?.note).toBe('2 waiting · oldest 1d / 1d promised');
    const clear = board.duties.find((d) => d.queueId === 'verifications');
    expect(clear?.note).toBe('clear · 2d promised');
  });

  it('keeps every hand-written duty, so a cadence is never silently empty', () => {
    const board = buildRoutineBoard({ queues: [], liveness: {}, restoreDrill: null });
    for (const duty of OPERATOR_DUTIES) {
      expect(board.duties.find((d) => d.id === duty.id), duty.id).toBeTruthy();
    }
    expect(dutiesFor(board, 'daily').length).toBeGreaterThan(0);
    expect(dutiesFor(board, 'weekly').length).toBeGreaterThan(0);
    expect(dutiesFor(board, 'monthly').length).toBeGreaterThan(0);
  });

  it('reads the restore drill as due when it is missing or too old, and clear when recent', () => {
    const missing = buildRoutineBoard({ queues: [], liveness: {}, restoreDrill: { ready: false, verifiedAt: null, ageDays: null } });
    expect(missing.duties.find((d) => d.id === 'restore-drill')?.status).toBe('due');
    const old = buildRoutineBoard({ queues: [], liveness: {}, restoreDrill: { ready: false, verifiedAt: '2026-01-01T00:00:00Z', ageDays: 60 } });
    expect(old.duties.find((d) => d.id === 'restore-drill')?.note).toContain('60d ago');
    const fresh = buildRoutineBoard({ queues: [], liveness: {}, restoreDrill: { ready: true, verifiedAt: '2026-09-01T00:00:00Z', ageDays: 4 } });
    expect(fresh.duties.find((d) => d.id === 'restore-drill')?.status).toBe('clear');
  });

  it('attaches liveness only to jobs that record it, and keeps "stale" apart from "unknown"', () => {
    const board = buildRoutineBoard({
      queues: [],
      liveness: { 'show-payouts': { kind: 'ran', at: 1 }, 'ad-settlement': { kind: 'stale' }, digest: { kind: 'unknown' } },
      restoreDrill: null,
    });
    const by = (key: string) => board.automated.find((j) => j.aliveKey === key)?.liveness;
    expect(by('show-payouts')).toEqual({ kind: 'ran', at: 1 });
    expect(by('ad-settlement')).toEqual({ kind: 'stale' });
    expect(by('digest')).toEqual({ kind: 'unknown' });
    // Untracked jobs carry null, never a fabricated state.
    expect(board.automated.find((j) => j.path === '/api/cron/daily-ops')?.liveness).toBeNull();
  });
});

describe('routineHeadline', () => {
  it('leads with what is waiting, then who it waits on, then quiet jobs', () => {
    const board = buildRoutineBoard({
      queues: [q({ id: 'payouts', slaHours: 24, count: 2, oldestHours: 30, overdue: true }), q({ id: 'support', slaHours: 168, count: 1, oldestHours: 2 })],
      liveness: { 'ad-settlement': { kind: 'stale' } },
      restoreDrill: null,
    });
    expect(routineHeadline(board)).toBe(
      '3 waiting, 1 past the promised turnaround · 1 daily duty needs you · 1 weekly duty needs you · 1 scheduled job has no recent run',
    );
  });

  it('says so when nothing needs anyone', () => {
    const board = buildRoutineBoard({ queues: [q({ id: 'payouts', slaHours: 24 })], liveness: {}, restoreDrill: null });
    expect(routineHeadline(board)).toBe('Nothing is waiting on you, and every tracked job has run.');
  });
});
