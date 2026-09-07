import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  RPO_CEILING_HOURS,
  RPO_TARGET_HOURS,
  SCHEDULED_HOURS,
  SCHEDULED_MINUTE,
  delayAgainstSlot,
  summariseCadence,
} from '../../../scripts/check-backup-cadence.mjs';

/**
 * The backup cadence probe.
 *
 * This exists because for at least six days every document in the repository
 * said "accepted RPO: 6 hours" while 48% of the real gaps exceeded it, and no
 * instrument noticed — they all asked whether a run SUCCEEDED, and every run
 * did. The arithmetic below is the part that would have caught it, so it is
 * tested rather than trusted.
 */

const at = (iso: string) => new Date(iso);

describe('delayAgainstSlot', () => {
  it('measures a run against the slot it belongs to', () => {
    expect(delayAgainstSlot(at('2026-09-06T15:19:00Z'))).toBeCloseTo(2.70, 2);
    expect(delayAgainstSlot(at('2026-09-06T20:16:00Z'))).toBeCloseTo(1.65, 2);
  });

  it('measures from the MINUTE the cron asks for, not the hour', () => {
    // The defect this replaces: measuring from the hour made the probe blind
    // to the :37 move it exists to judge. The 2026-09-07 12:37 run landed at
    // 12:58 — 21 min late, and reported as 58 min under the old arithmetic.
    expect(delayAgainstSlot(at('2026-09-07T12:58:32Z'))).toBeCloseTo(0.36, 2);
  });

  it('is zero for a run that fires exactly on its slot', () => {
    expect(delayAgainstSlot(at('2026-09-06T12:37:00Z'))).toBe(0);
  });

  it('attributes a run to the nearest slot at or before it', () => {
    // 01:30 reads as the 00:37 run 53 min late, which is the right call at the
    // observed delays: the alternative reading, an 18:37 run 6.9 h late, is
    // the rarer one.
    expect(delayAgainstSlot(at('2026-09-07T01:30:00Z'))).toBeCloseTo(0.88, 2);
  });

  it('measures a run landing BEFORE the day\'s first slot against yesterday', () => {
    // 00:10 precedes 00:37, so the slot it belongs to is yesterday's 18:37.
    // Getting this wrong reports a negative delay, which reads as early.
    expect(delayAgainstSlot(at('2026-09-07T00:10:00Z'))).toBeCloseTo(5.55, 2);
  });

  it('under-reports a run delayed past a whole interval — a known limit, not a bug', () => {
    // A run more than one interval late is indistinguishable from the NEXT
    // slot running early, and nothing in the API says which slot a run was
    // asked for. So delay is diagnostic only. The GAP between dumps is the RPO
    // figure and is immune to this entirely: it never asks which slot a run
    // belonged to. Judge the gap; read the delay as a hint about the queue.
    const sevenHoursLateFor18 = at('2026-09-07T01:37:00Z');
    expect(delayAgainstSlot(sevenHoursLateFor18)).toBeCloseTo(1, 2); // not 7
  });

  it('wraps to the previous day when no slot precedes the run', () => {
    // Only reachable on a schedule with no midnight slot, but the branch has
    // to be right or such a schedule reports negative delays.
    expect(delayAgainstSlot(at('2026-09-07T02:37:00Z'), [6, 12, 18])).toBeCloseTo(8, 2);
  });
});

describe('summariseCadence', () => {
  const evenly = (count: number, stepHours: number, start = '2026-09-01T00:00:00Z') =>
    Array.from({ length: count }, (_, i) => new Date(Date.parse(start) + i * stepHours * 3_600_000));

  it('reports ok when every gap is inside the target', () => {
    const runs = evenly(8, 6);
    const s = summariseCadence(runs, new Date(runs[runs.length - 1].getTime() + 3_600_000));
    expect(s.verdict).toBe('ok');
    expect(s.breached).toBe(false);
    expect(s.overTargetCount).toBe(0);
  });

  it('flags gaps past the target as advisory, NOT as a failure', () => {
    // GitHub's queue is not something anyone here can clear, so drifting past
    // the target reports loudly and still exits 0. Only the ceiling fails.
    const runs = [at('2026-09-01T00:00:00Z'), at('2026-09-01T10:00:00Z')];
    const s = summariseCadence(runs, at('2026-09-01T11:00:00Z'));
    expect(s.verdict).toBe('over-target');
    expect(s.overTargetCount).toBe(1);
    expect(s.breached).toBe(false);
  });

  it('breaches when a gap doubles the promise', () => {
    const runs = [at('2026-09-01T00:00:00Z'), at('2026-09-01T13:00:00Z')];
    const s = summariseCadence(runs, at('2026-09-01T14:00:00Z'));
    expect(s.breached).toBe(true);
    expect(s.verdict).toBe('breached');
  });

  it('catches a workflow that has STOPPED, which no historical gap can show', () => {
    // The failure a gap history structurally cannot see: a perfect run of
    // six-hourly dumps that ended yesterday still has perfect gaps. Silence is
    // judged on the current gap instead.
    const runs = evenly(6, 6);
    const s = summariseCadence(runs, new Date(runs[runs.length - 1].getTime() + 30 * 3_600_000));
    expect(s.gaps!.max).toBeCloseTo(6, 5);
    expect(s.stalled).toBe(true);
    expect(s.verdict).toBe('stalled');
  });

  it('reports unmeasurable rather than ok when there are no runs', () => {
    // "No runs found" and "runs are healthy" must never render the same way:
    // an empty answer is the shape a broken query returns.
    const s = summariseCadence([], new Date());
    expect(s.measurable).toBe(false);
    expect(s.verdict).toBeUndefined();
  });

  it('reproduces the 2026-09-06 measurement that prompted this probe', () => {
    const runs = [
      '2026-09-05T14:58:15Z', '2026-09-05T20:12:38Z', '2026-09-06T04:08:41Z',
      '2026-09-06T10:42:26Z', '2026-09-06T15:19:02Z', '2026-09-06T20:16:39Z',
    ].map(at);
    const s = summariseCadence(runs, at('2026-09-07T01:31:00Z'));
    expect(s.gaps!.max).toBeCloseTo(7.93, 2);
    // Against the 6 h that used to be documented, this window breached; against
    // the 8 h now documented it does not. Both readings are of the same data —
    // which is the point of writing the measured number down.
    expect(summariseCadence(runs, at('2026-09-07T01:31:00Z'), { targetHours: 6 }).overTargetCount).toBe(2);
    expect(s.overTargetCount).toBe(0);
  });

  it('catches the 16.70 h gap its first real run found', () => {
    // The night of 2026-09-07. The cron moved from :00 to :37 at 01:53 UTC and
    // the 00:xx and 06:xx dumps never ran — changing a workflow's schedule
    // drops the tick already pending. That is a real exposure on the only copy
    // of the database outside the live cluster, so it must breach, not merely
    // warn: it is over DOUBLE the promise, and the fix (dispatch the workflow
    // by hand after a schedule change) is entirely in our own hands.
    const runs = [
      '2026-09-06T15:19:02Z', '2026-09-06T20:16:39Z', '2026-09-07T12:58:32Z',
    ].map(at);
    const s = summariseCadence(runs, at('2026-09-07T13:26:00Z'));
    expect(s.gaps!.max).toBeCloseTo(16.70, 2);
    expect(s.verdict).toBe('breached');
  });

  it('lets a resolved breach age out of the verdict while keeping it in the record', () => {
    // The same gap, read three days later. Judged over the full history it
    // would fail the nightly every night for a week for one incident with a
    // known cause and a written fix — which is how a board stops being read.
    // A STANDING fault keeps producing fresh gaps and so keeps breaching; only
    // a resolved one ages out. The figure stays in the reported history.
    const runs = [
      '2026-09-06T15:19:02Z', '2026-09-06T20:16:39Z', '2026-09-07T12:58:32Z',
      '2026-09-07T18:39:00Z', '2026-09-08T00:38:00Z', '2026-09-08T06:41:00Z',
      '2026-09-08T12:38:00Z', '2026-09-08T18:40:00Z', '2026-09-09T00:39:00Z',
      '2026-09-09T06:38:00Z', '2026-09-09T12:40:00Z',
    ].map(at);
    const s = summariseCadence(runs, at('2026-09-09T13:26:00Z'));
    expect(s.gaps!.max).toBeCloseTo(16.70, 2); // still in the record
    expect(s.verdict).toBe('ok');
    expect(s.breached).toBe(false);
  });
});

describe('a dump taken outside the schedule', () => {
  const evenly = (count: number, stepHours: number, start = '2026-09-01T00:00:00Z') =>
    Array.from({ length: count }, (_, i) => new Date(Date.parse(start) + i * stepHours * 3_600_000));

  it('is reported as protection but NEVER clears the verdict', () => {
    // 2026-09-07: the 18:37 slot did not fire, so a manual dispatch took the
    // dump at 18:56. The data was protected 20 minutes later while the probe
    // went on reporting "since last dump: 6 h" — a false alarm worth fixing.
    const scheduled = [at('2026-09-06T20:16:39Z'), at('2026-09-07T12:58:32Z')];
    const s = summariseCadence(scheduled, at('2026-09-07T19:16:00Z'), {
      offScheduleTimes: [at('2026-09-07T18:56:45Z')],
    });
    expect(s.sinceLastHours).toBeCloseTo(6.29, 1); // the SCHEDULE is 6 h stale
    expect(s.sinceAnyDumpHours).toBeCloseTo(0.32, 1); // the DATA is 19 min old
    expect(s.verdict).toBe('breached'); // and the 16.70 h gap still stands
  });

  it('cannot prop up a dead schedule — the whole reason it is not judged', () => {
    // The naive fix. A schedule that stopped three days ago, with somebody
    // dispatching by hand every few hours, must still read STALLED: gaps,
    // delays and silence all ask whether the AUTOMATION is alive, and a
    // hand-fed one that reads healthy is the failure this file exists to stop.
    const scheduled = evenly(6, 6);
    const dead = new Date(scheduled[scheduled.length - 1].getTime() + 72 * 3_600_000);
    const s = summariseCadence(scheduled, dead, {
      offScheduleTimes: [new Date(dead.getTime() - 3_600_000)],
    });
    expect(s.stalled).toBe(true);
    expect(s.verdict).toBe('stalled');
    expect(s.sinceAnyDumpHours).toBeCloseTo(1, 5);
  });

  it('is ignored when it is older than the last scheduled dump', () => {
    // Only a dump MORE RECENT than the schedule's own tells the reader
    // anything; an older one would understate how protected the data is.
    const scheduled = [at('2026-09-07T06:37:00Z'), at('2026-09-07T12:37:00Z')];
    const s = summariseCadence(scheduled, at('2026-09-07T13:00:00Z'), {
      offScheduleTimes: [at('2026-09-07T04:00:00Z')],
    });
    expect(s.lastOffScheduleDump).toBeNull();
    expect(s.sinceAnyDumpHours).toBe(s.sinceLastHours);
  });
});

describe('the probe agrees with the workflow it measures', () => {
  const workflow = readFileSync('.github/workflows/backup-database.yml', 'utf8');

  it('reads the same slots the cron actually asks for', () => {
    // A probe carrying its own copy of the schedule is the defect it exists to
    // catch. If the cron moves and this does not, the delay column is nonsense.
    const cron = workflow.match(/- cron: '(\d+) ([\d,]+) \* \* \*'/);
    expect(cron, 'backup-database.yml must carry one daily cron').not.toBeNull();
    const hours = cron![2].split(',').map(Number);
    expect(hours).toEqual(SCHEDULED_HOURS);
  });

  it('reads the same MINUTE the cron asks for', () => {
    // Moved off :00 on 2026-09-07 after 24 runs measured a 2.21-5.48 h delay,
    // never once on time; the next run landed 21 min late. Putting it back
    // re-enters the queue everything else in the world is also asking for, and
    // a probe carrying a stale minute reports every delay 37 min wrong.
    const cron = workflow.match(/- cron: '(\d+) ([\d,]+) \* \* \*'/);
    expect(Number(cron![1])).toBeGreaterThan(0);
    expect(Number(cron![1])).toBe(SCHEDULED_MINUTE);
  });

  it('keeps the ceiling above the target, or the advisory band vanishes', () => {
    expect(RPO_CEILING_HOURS).toBeGreaterThan(RPO_TARGET_HOURS);
  });
});
