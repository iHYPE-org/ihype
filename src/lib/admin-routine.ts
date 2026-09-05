import type { WorkbenchQueue } from '@/lib/admin-workbench';

/**
 * The operator's routine, and the machine's.
 *
 * ## The question this answers
 *
 * `admin-workbench.ts` says what is waiting on a human right now. What it
 * cannot say is HOW OFTEN a human has to look, and which of the jobs an
 * operator might think are theirs already run themselves at 13:00 UTC. So the
 * console's "Today" board listed eight queues at equal weight — a 24-hour
 * payout promise beside a feature-request inbox with no promise at all — and
 * nothing anywhere on the console said that payouts, settlement, backups, the
 * acceptance walk and the digest are done by a cron or a workflow, not by the
 * person reading the board. An operator who does not know that either does the
 * machine's work by hand or, worse, assumes the machine does theirs.
 *
 * This module cuts the same facts three ways:
 *
 *   DAILY     what a person looks at every day
 *   WEEKLY    what a person looks at once a week
 *   MONTHLY   what a person does once a month
 *   AUTOMATED what the platform does on a schedule with nobody watching, and
 *             when it last did it (from the `cron-alive:*` liveness keys the
 *             jobs already write)
 *
 * ## Where the cadence comes from
 *
 * A queue's cadence is DERIVED from the turnaround the product promises for it
 * (`WorkbenchQueue.slaHours`), never assigned by hand: a promise of 96 hours or
 * less cannot be kept on a weekly look, so it is daily; anything looser, or
 * with no promise, is weekly. The 12:00 UTC workbench digest is what catches an
 * item going overdue between looks, so "weekly" is a floor on attention and not
 * a permission to ignore a queue for six days.
 *
 * ## Two copies of one schedule, and the test that keeps them one
 *
 * `AUTOMATED_JOBS` restates every dispatcher entry in `workers/cron.ts`. That
 * file is bundled on its own by wrangler and deliberately imports nothing from
 * `src/`, so it cannot be the source this module reads; the alternative — the
 * app importing the worker — would drag a Worker entry point into the Next
 * bundle. Two copies are the honest shape, and `admin-routine.test.ts` fails
 * the moment they disagree in either direction (a job here that the worker no
 * longer dispatches, or a dispatched job this board would not show). Same for
 * the two GitHub schedules and for the liveness keys.
 *
 * Pure and dependency-light — no `@/lib/db`, no `@/lib/kv` — so the unit suite
 * and a client component can both load it. The reads are in
 * `admin-routine-data.ts`.
 */

export type OperatorCadence = 'daily' | 'weekly' | 'monthly';

export type RoutineDuty = {
  id: string;
  cadence: OperatorCadence;
  label: string;
  /** What the operator actually does, in a sentence. */
  detail: string;
  /** Where to do it. Absent when the duty is reading something sent to them. */
  href?: string;
  /** The workbench queue whose live count and promise this duty carries. */
  queueId?: string;
  /** When in the day or week it is due, in the operator's terms. */
  when?: string;
};

/** How loose a promise can be and still be checked daily. */
export const DAILY_SLA_CEILING_HOURS = 96;

/**
 * A queue with a promise of `DAILY_SLA_CEILING_HOURS` or less is a daily look;
 * anything looser, or with no promise at all, is weekly. Exported so the rule
 * is tested rather than implied by the fixture.
 */
export function cadenceForQueue(slaHours: number | null): OperatorCadence {
  if (slaHours !== null && slaHours <= DAILY_SLA_CEILING_HOURS) return 'daily';
  return 'weekly';
}

/** Duties that are not a queue: things sent to the operator, or done by hand. */
export const OPERATOR_DUTIES: readonly RoutineDuty[] = [
  {
    id: 'nightly-board',
    cadence: 'daily',
    label: 'Read last night’s board',
    detail:
      'The nightly ran the audits, the acceptance walk and the feature-health board at 07:00 UTC. Only a BROKEN journey fails it; PARTIAL and UNPROVEN print loudly and are yours to read.',
    href: 'https://github.com/iHYPE-org/ihype/actions/workflows/nightly.yml',
    when: 'after 07:00 UTC',
  },
  {
    id: 'ops-mail',
    cadence: 'daily',
    label: 'Read the 07:00 ops report; act on a 12:00 digest',
    detail:
      'The daily ops report always arrives. The workbench digest at 12:00 UTC arrives only when a queue is past its promise — no digest is good news, not a missed one.',
    when: 'morning',
  },
  {
    id: 'weekly-report',
    cadence: 'weekly',
    label: 'Read the Monday admin report',
    detail:
      'Sent at 09:00 UTC on Mondays: new users, profiles and shows for the week, campaigns awaiting review, flagged uploads, open feature requests and bug reports.',
    when: 'Monday',
  },
  {
    id: 'backups',
    cadence: 'weekly',
    label: 'Confirm the encrypted backup ran and named its keys',
    detail:
      'Every six hours a pg_dump is encrypted and written to R2. There is no Supabase PITR on this plan, so those objects are the only copy outside the live cluster — a run that says SKIPPED means there is none.',
    href: 'https://github.com/iHYPE-org/ihype/actions/workflows/backup-database.yml',
    when: 'any day',
  },
  {
    id: 'advisories',
    cadence: 'weekly',
    label: 'Compare the advisory audit numbers with last week’s',
    detail:
      'The nightly reports audit:spacing, audit:design and audit:shell --strict without failing on them. A number drifting up is visible only if someone reads it, and a new npm advisory is checked against docs/dependency-advisories.md before anyone acts on it.',
    href: 'https://github.com/iHYPE-org/ihype/actions/workflows/nightly.yml',
    when: 'any day',
  },
  {
    id: 'restore-drill',
    cadence: 'monthly',
    label: 'Run the backup restore drill',
    detail:
      'Restore the latest encrypted dump into a scratch database and set RESTORE_DRILL_VERIFIED_AT to when you did. Alpha readiness refuses a drill older than 35 days, and an unopenable backup is found out during the incident otherwise.',
    href: '/admin?tab=system',
    when: 'first week of the month',
  },
];

export type ScheduleCadence = 'continuous' | 'daily' | 'weekly' | 'monthly';

export type AutomatedJob = {
  /** The dispatcher path, exactly as `workers/cron.ts` writes it. */
  path: string;
  /** The cron expression, exactly as `workers/cron.ts` writes it. */
  schedule: string;
  label: string;
  /** What it does, in the operator's terms — so nobody does it by hand. */
  what: string;
  /**
   * The name the job passes to `pingCronAlive()`, when it records one. Jobs
   * without it are still listed; they read "not tracked" rather than "never
   * ran", because those are different facts.
   */
  aliveKey?: string;
};

/**
 * Every dispatcher entry in `workers/cron.ts`, described. Order here is by the
 * hour of the day it fires, because that is how an operator thinks about "what
 * happens overnight"; the test compares SETS, not order.
 */
export const AUTOMATED_JOBS: readonly AutomatedJob[] = [
  { path: '/api/cron/show-lifecycle', schedule: '*/5 * * * *', label: 'Show lifecycle', what: 'Moves shows SCHEDULED → LIVE → ENDED on their times' },
  { path: '/api/cron/expire-reservations', schedule: '*/5 * * * *', label: 'Expire reservations', what: 'Voids ticket orders left unpaid past the Checkout window' },
  { path: '/api/cron/notification-jobs', schedule: '*/5 * * * *', label: 'Notification jobs', what: 'Delivers queued notifications and retries failed ones', aliveKey: 'notification-jobs' },
  { path: '/api/cron/publish-scheduled', schedule: '*/15 * * * *', label: 'Publish scheduled releases', what: 'Flips tracks and albums live on their release date and tells the artist' },
  { path: '/api/cron/capacity-alerts', schedule: '0 * * * *', label: 'Capacity alerts', what: 'Warns organisers when a show is close to selling out' },
  { path: '/api/cron/anomaly-check', schedule: '0 * * * *', label: 'Anomaly check', what: 'Looks for traffic and signup patterns that need a person' },
  { path: '/api/cron/rsvp-reminders', schedule: '0 * * * *', label: 'RSVP reminders', what: 'Reminds fans about shows they said they would attend' },
  { path: '/api/cron?job=health-check', schedule: '0 */6 * * *', label: 'Health check', what: 'Reads /api/health, stale cron liveness and email readiness; alerts through Sentry, never only by email' },
  { path: '/api/cron?job=db-health', schedule: '0 */6 * * *', label: 'Database health', what: 'Confirms the database answers and records the result', aliveKey: 'db-health' },
  { path: '/api/cron?job=stripe-connect-health', schedule: '0 */6 * * *', label: 'Stripe Connect reconciliation', what: 'Asks Stripe whether pending payout accounts finished KYC and promotes them — never demotes', aliveKey: 'stripe-connect-health' },
  { path: '/api/cron?job=close-stale-bookings', schedule: '0 1 * * *', label: 'Close stale bookings', what: 'Expires booking requests nobody answered', aliveKey: 'close-stale-bookings' },
  { path: '/api/cron?job=session-cleanup', schedule: '0 3 * * *', label: 'Session cleanup', what: 'Deletes expired sessions', aliveKey: 'session-cleanup' },
  { path: '/api/cron?job=push-cleanup', schedule: '0 3 * * *', label: 'Push cleanup', what: 'Drops push subscriptions the platform rejected', aliveKey: 'push-cleanup' },
  { path: '/api/cron?job=identity-detach', schedule: '0 3 * * *', label: 'Identity detach', what: 'Scrubs IP addresses older than 30 days from the audit log', aliveKey: 'identity-detach' },
  { path: '/api/cron/dmca-enforce', schedule: '30 3 * * *', label: 'DMCA enforcement', what: 'Acts on CONFIRMED notices only — a notice is confirmed by a person, never automatically' },
  { path: '/api/cron?job=audit-log-rotate', schedule: '0 4 * * 1', label: 'Audit log rotation', what: 'Archives audit rows past retention', aliveKey: 'audit-log-rotate' },
  { path: '/api/cron/backup-verify', schedule: '0 5 * * *', label: 'Backup verification', what: 'Confirms the live database and migration state; warns when the restore drill is due' },
  { path: '/api/cron?job=feature-shows', schedule: '0 6 * * *', label: 'Feature shows', what: 'Picks the shows the discover surfaces feature today', aliveKey: 'feature-shows' },
  { path: '/api/cron/daily-ops', schedule: '0 7 * * *', label: 'Daily ops report', what: 'Emails the administrators yesterday’s signups, revenue, open support and flagged shows' },
  { path: '/api/cron?job=digest', schedule: '0 8 * * *', label: 'Member digest', what: 'Emails members their daily digest', aliveKey: 'digest' },
  { path: '/api/cron/social-digest', schedule: '30 8 * * 1', label: 'Social digest', what: 'Drafts the week’s social posts for the console' },
  { path: '/api/cron?job=weekly-picks', schedule: '0 9 * * 1', label: 'Weekly picks', what: 'Emails fans the week’s picks', aliveKey: 'weekly-picks' },
  { path: '/api/cron?job=artist-digest', schedule: '0 9 * * 1', label: 'Artist digest', what: 'Emails artists their week of listens, follows and hypes' },
  { path: '/api/cron?job=admin-report', schedule: '0 9 * * 1', label: 'Weekly admin report', what: 'Emails the administrators the week’s numbers — the Monday duty above is reading it' },
  { path: '/api/cron?job=follow-digest', schedule: '0 9 * * 1', label: 'Follow digest', what: 'Emails fans what the acts they follow did this week', aliveKey: 'follow-digest' },
  { path: '/api/cron/weekly-digest', schedule: '0 9 * * 1', label: 'Weekly listening digest', what: 'Emails members their week of hypes and saves' },
  { path: '/api/cron/nearby-show-notify', schedule: '0 9 * * *', label: 'Nearby show notices', what: 'Tells fans about shows near them' },
  { path: '/api/cron/artist-earnings', schedule: '0 9 1 * *', label: 'Artist earnings summary', what: 'Emails artists last month’s earnings' },
  { path: '/api/cron?job=new-to-scene', schedule: '0 10 * * *', label: 'New to the scene', what: 'Surfaces newly arrived acts to fans nearby', aliveKey: 'new-to-scene' },
  { path: '/api/cron?job=artist-onboarding', schedule: '0 11 * * *', label: 'Artist onboarding nudges', what: 'Nudges artists who stopped partway through setup', aliveKey: 'artist-onboarding' },
  { path: '/api/cron?job=show-reminders', schedule: '0 12 * * *', label: 'Show reminders', what: 'Reminds ticket holders about tomorrow’s show', aliveKey: 'show-reminders' },
  { path: '/api/cron?job=workbench-digest', schedule: '0 12 * * *', label: 'Workbench digest', what: 'Emails the administrators ONLY when a queue is past its promised turnaround', aliveKey: 'workbench-digest' },
  { path: '/api/cron?job=held-track-notice', schedule: '0 12 * * *', label: 'Held-track notice', what: 'Tells an artist once their flagged upload has waited five days — never auto-publishes it', aliveKey: 'held-track-notice' },
  { path: '/api/cron?job=show-payouts', schedule: '0 13 * * *', label: 'Show payouts', what: 'Transfers every PENDING payable on an ENDED show through Stripe and emails the recipient — do not pay anyone by hand', aliveKey: 'show-payouts' },
  { path: '/api/cron?job=ad-settlement', schedule: '0 13 * * *', label: 'Ad settlement', what: 'Refunds the unspent remainder of every finished campaign and records what Stripe did', aliveKey: 'ad-settlement' },
  { path: '/api/cron?job=onboarding', schedule: '0 14 * * *', label: 'Member onboarding', what: 'Sends the next onboarding step to new members', aliveKey: 'onboarding' },
  { path: '/api/cron/welcome-sequence', schedule: '0 15 * * *', label: 'Welcome sequence', what: 'Sends the welcome drip' },
  { path: '/api/cron/post-show-recap', schedule: '0 16 * * *', label: 'Post-show recap', what: 'Sends attendees the morning-after recap' },
];

export type ScheduledWorkflow = {
  /** The workflow file under `.github/workflows/`. */
  file: string;
  schedule: string;
  label: string;
  what: string;
  href: string;
};

/** The two things GitHub runs on a schedule. Guarded against the yml, like the crons. */
export const SCHEDULED_WORKFLOWS: readonly ScheduledWorkflow[] = [
  {
    file: 'nightly.yml',
    schedule: '0 7 * * *',
    label: 'Nightly',
    what: 'Every audit gate, typecheck, lint and unit tests, the basemap and store-link checks, then the full alpha acceptance walk against a built worker and the feature-health board',
    href: 'https://github.com/iHYPE-org/ihype/actions/workflows/nightly.yml',
  },
  {
    file: 'backup-database.yml',
    schedule: '0 0,6,12,18 * * *',
    label: 'Database backup',
    what: 'Encrypted pg_dump to R2, decrypted once to prove it opens, into rotating daily, weekly and monthly slots',
    href: 'https://github.com/iHYPE-org/ihype/actions/workflows/backup-database.yml',
  },
];

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function clock(hour: string, minute: string): string {
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')} UTC`;
}

/**
 * A cron expression in words, for the handful of shapes this repository
 * actually uses. Anything else comes back verbatim rather than guessed: a
 * wrong sentence about when money moves is worse than the expression.
 */
export function describeSchedule(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [minute, hour, dom, month, dow] = parts;
  if (month !== '*') return cron;
  if (minute.startsWith('*/') && hour === '*' && dom === '*' && dow === '*') return `every ${minute.slice(2)} min`;
  if (hour.startsWith('*/') && dom === '*' && dow === '*') return `every ${hour.slice(2)} h`;
  if (hour === '*' && dom === '*' && dow === '*') return minute === '0' ? 'hourly' : `hourly at :${minute.padStart(2, '0')}`;
  if (/^\d+(,\d+)+$/.test(hour) && dom === '*' && dow === '*') {
    return `daily at ${hour.split(',').map((h) => h.padStart(2, '0')).join(', ')}:${minute.padStart(2, '0')} UTC`;
  }
  if (!/^\d+$/.test(minute) || !/^\d+$/.test(hour)) return cron;
  if (dow !== '*') {
    const day = DOW[Number(dow)];
    return day ? `${day} ${clock(hour, minute)}` : cron;
  }
  if (dom !== '*') {
    if (!/^\d+$/.test(dom)) return cron;
    const n = Number(dom);
    const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
    return `${n}${suffix} of the month, ${clock(hour, minute)}`;
  }
  return `daily ${clock(hour, minute)}`;
}

export function cadenceForSchedule(cron: string): ScheduleCadence {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return 'continuous';
  const [minute, hour, dom, , dow] = parts;
  if (minute.includes('*') || hour.includes('*') || hour.includes(',')) return 'continuous';
  if (dow !== '*') return 'weekly';
  if (dom !== '*') return 'monthly';
  return 'daily';
}

/** The order the cadences read in, and the one the tabs use. */
export const SCHEDULE_CADENCE_ORDER: readonly ScheduleCadence[] = ['daily', 'weekly', 'monthly', 'continuous'];

export type DutyStatus = 'overdue' | 'due' | 'waiting' | 'info' | 'clear';

export type RoutineDutyRow = RoutineDuty & {
  status: DutyStatus;
  /** Live count from the queue; `null` when the duty is not a queue. */
  count: number | null;
  /** One line under the label: "3 waiting · oldest 2d / 48h", "verified 12d ago", or `when`. */
  note: string;
};

export type LivenessRead =
  /** The job wrote its key: it last finished at this time. */
  | { kind: 'ran'; at: number }
  /** The key is absent: no run inside the key's TTL. */
  | { kind: 'stale' }
  /** KV could not be read. Not a claim either way. */
  | { kind: 'unknown' };

export type AutomatedJobRow = AutomatedJob & {
  scheduleText: string;
  cadence: ScheduleCadence;
  liveness: LivenessRead | null;
};

export type RestoreDrillRead = { ready: boolean; verifiedAt: string | null; ageDays: number | null };

export type RoutineBoardInput = {
  queues: WorkbenchQueue[];
  /** `aliveKey` → what KV said. Absent key = the read was not attempted. */
  liveness: Record<string, LivenessRead>;
  restoreDrill: RestoreDrillRead | null;
  now?: number;
};

export type RoutineBoard = {
  duties: RoutineDutyRow[];
  automated: AutomatedJobRow[];
  workflows: ScheduledWorkflow[];
  /** When the board was built. Relative times render against THIS, never against
   *  the client's clock, so the server and the hydrated client print the same
   *  text. */
  now: number;
};

const STATUS_ORDER: Record<DutyStatus, number> = { overdue: 0, due: 1, waiting: 2, info: 3, clear: 4 };

function formatHours(hours: number): string {
  if (hours < 1) return 'just now';
  if (hours < 24) return `${Math.floor(hours)}h`;
  return `${Math.floor(hours / 24)}d`;
}

function queueDuty(queue: WorkbenchQueue): RoutineDutyRow {
  const status: DutyStatus = queue.overdue ? 'overdue' : queue.count > 0 ? 'waiting' : 'clear';
  const promise = queue.slaHours ? ` / ${formatHours(queue.slaHours)} promised` : '';
  const note =
    queue.count === 0
      ? `clear${queue.slaHours ? ` · ${formatHours(queue.slaHours)} promised` : ''}`
      : `${queue.count} waiting${queue.oldestHours !== null ? ` · oldest ${formatHours(queue.oldestHours)}` : ''}${promise}`;
  return {
    id: `queue-${queue.id}`,
    cadence: cadenceForQueue(queue.slaHours),
    label: queue.label,
    detail: queue.detail,
    href: queue.href,
    queueId: queue.id,
    status,
    count: queue.count,
    note,
  };
}

function restoreDrillDuty(duty: RoutineDuty, drill: RestoreDrillRead | null): RoutineDutyRow {
  if (!drill) return { ...duty, status: 'info', count: null, note: duty.when ?? '' };
  if (drill.verifiedAt === null) return { ...duty, status: 'due', count: null, note: 'no drill recorded — RESTORE_DRILL_VERIFIED_AT is unset' };
  const age = drill.ageDays ?? 0;
  return drill.ready
    ? { ...duty, status: 'clear', count: null, note: `verified ${age}d ago · due again at 35d` }
    : { ...duty, status: 'due', count: null, note: `last verified ${age}d ago — past the 35-day limit` };
}

export function buildRoutineBoard(input: RoutineBoardInput): RoutineBoard {
  const duties: RoutineDutyRow[] = [
    ...input.queues.map(queueDuty),
    ...OPERATOR_DUTIES.map((duty) =>
      duty.id === 'restore-drill'
        ? restoreDrillDuty(duty, input.restoreDrill)
        : { ...duty, status: 'info' as DutyStatus, count: null, note: duty.when ?? '' },
    ),
  ].sort((a, b) => {
    if (STATUS_ORDER[a.status] !== STATUS_ORDER[b.status]) return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    return a.label.localeCompare(b.label);
  });

  const automated: AutomatedJobRow[] = AUTOMATED_JOBS.map((job) => ({
    ...job,
    scheduleText: describeSchedule(job.schedule),
    cadence: cadenceForSchedule(job.schedule),
    liveness: job.aliveKey ? input.liveness[job.aliveKey] ?? null : null,
  }));

  return { duties, automated, workflows: [...SCHEDULED_WORKFLOWS], now: input.now ?? Date.now() };
}

export function dutiesFor(board: RoutineBoard, cadence: OperatorCadence): RoutineDutyRow[] {
  return board.duties.filter((d) => d.cadence === cadence);
}

/**
 * The one line above the tabs. Leads with what is waiting, then who it is
 * waiting on by cadence, then any scheduled job that has gone quiet — and says
 * so plainly when all of that is nothing, because "clear" is a finding too.
 */
export function routineHeadline(board: RoutineBoard): string {
  const queues = board.duties.filter((d) => d.queueId);
  const waiting = queues.reduce((sum, d) => sum + (d.count ?? 0), 0);
  const overdue = queues.filter((d) => d.status === 'overdue').length;
  const needs = (c: OperatorCadence) =>
    dutiesFor(board, c).filter((d) => d.status === 'overdue' || d.status === 'due' || d.status === 'waiting').length;
  const parts: string[] = [];
  if (waiting > 0) parts.push(`${waiting} waiting${overdue > 0 ? `, ${overdue} past the promised turnaround` : ''}`);
  for (const cadence of ['daily', 'weekly', 'monthly'] as const) {
    const n = needs(cadence);
    if (n > 0) parts.push(`${n} ${cadence} ${n === 1 ? 'duty needs' : 'duties need'} you`);
  }
  const stale = board.automated.filter((j) => j.liveness?.kind === 'stale').length;
  if (stale > 0) parts.push(`${stale} scheduled ${stale === 1 ? 'job has' : 'jobs have'} no recent run`);
  if (parts.length === 0) return 'Nothing is waiting on you, and every tracked job has run.';
  return parts.join(' · ');
}
