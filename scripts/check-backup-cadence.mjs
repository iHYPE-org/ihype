/**
 * Does the backup cadence match the RPO we promise?
 *
 * WHY THIS EXISTS. `backup-database.yml` asks GitHub for 00:00, 06:00, 12:00
 * and 18:00 UTC, and every document in this repository read that request as
 * the delivered cadence and wrote "accepted RPO: 6 hours" on top of it. It is
 * not delivered. Measured over 24 successful scheduled runs (2026-09-01 →
 * 09-06): **not one fired on time** — median delay 4.14 h, worst 5.48 h — and
 * because the delay VARIES between 2.2 h and 5.5 h, the gap between
 * consecutive dumps swings from 4.47 h to 7.93 h. **48% of gaps exceeded the
 * 6 hours we had written down**, for at least six days, and nothing noticed,
 * because every instrument here checked whether a run SUCCEEDED. They all did.
 *
 * A scheduled workflow is a REQUEST, not a guarantee — GitHub publishes no
 * scheduling SLA and queues heaviest at the top of the hour. So the cadence
 * cannot be asserted from the cron expression; it has to be measured from what
 * actually ran. That is the whole job of this file.
 *
 * WHAT IT MEASURES, and the distinction that matters: the DELAY of each run
 * against its slot is diagnostic (it says how congested the queue is), but the
 * GAP between consecutive dumps is the RPO — a uniformly late schedule still
 * averages six hours between dumps, and it is the VARIANCE in the delay that
 * opens a long gap. Judge the gap; report the delay.
 *
 * WHAT ITS FIRST RUN FOUND, which is a rule about scheduled workflows in
 * general: **changing a workflow's cron drops the tick that was already
 * pending.** `backup-database.yml` moved from :00 to :37 at 01:53 UTC on
 * 2026-09-07, and the 00:xx and 06:xx dumps then never ran — a **16.70 h gap**
 * on the only copy of the database outside the live cluster, caused by the
 * change intended to shorten the gaps. So: after editing the schedule of any
 * workflow whose job is to run on time, dispatch it once by hand. The move
 * itself worked — the next run landed 21 min after its slot against a 4.08 h
 * median before it — which is exactly the kind of claim that needs a probe
 * rather than an argument.
 *
 * WHY IT WARNS RATHER THAN FAILING at the target: the delay is GitHub's
 * queue, not something anybody working in this repository can clear, and a
 * check nobody can clear is a wall in front of the instruments rather than a
 * gate (see `check:app-links`, which sat in front of the whole nightly on its
 * first run). It fails only past `RPO_CEILING_HOURS`, where the promise has
 * not merely slipped but doubled — two slots effectively lost, which is a real
 * data-loss exposure and IS actionable: add a slot, or move the schedule off
 * GitHub's queue entirely.
 *
 * Exit codes follow this repo's convention:
 *   0  every gap inside the target
 *   1  a gap past the ceiling, or the workflow has stopped running entirely
 *   2  could not be measured (no network, no runs) — honest degradation, NOT a pass
 *
 * A CALLER MUST DECIDE WHERE TO FAIL, NOT ONLY WHETHER TO. Sequenced as a
 * hard gate near the top of the nightly, exit 1 here skipped the unit tests,
 * every audit and the entire acceptance walk — the fault that job's own
 * comments document about `check:app-links`, re-created by the check written
 * to avoid it. The nightly now records this exit code and fails at the END.
 *
 * Usage: npm run check:backup-cadence [-- --json] [-- --repo=owner/name]
 */
import { fileURLToPath } from 'node:url';

/** The slots `backup-database.yml` asks for, in UTC hours. Keep in step with its cron. */
export const SCHEDULED_HOURS = [0, 6, 12, 18];

/**
 * ...and the minute within them. The first version of this file measured
 * against the HOUR alone, which made it blind to the one change it exists to
 * judge: the cron moved to :37 on 2026-09-07 to get off GitHub's most
 * congested minute, and every delay then read 37 minutes high — the run that
 * fired 21 min after its slot was reported as 58 min late. A probe that cannot
 * see the intervention is not evidence about the intervention.
 */
export const SCHEDULED_MINUTE = 37;

/**
 * What we PROMISE, in `docs/runbooks/backup-restore-drill.md`.
 *
 * 8 rather than 6 because 8 is what has been measured; a promise the platform
 * does not underwrite is worse than a candid one. The schedule still requests
 * six-hourly, and if the `:37` move (2026-09-07) pulls the worst case down,
 * lower this — but lower it against a fresh run of this script, never against
 * the cron expression.
 */
export const RPO_TARGET_HOURS = 8;

/** Past this the promise has doubled: two slots effectively lost. */
export const RPO_CEILING_HOURS = 12;

/** No successful scheduled run in this long means the workflow is not running at all. */
export const SILENCE_CEILING_HOURS = 26;

/**
 * How far back the VERDICT looks — the distribution above it is reported over
 * the whole window the API returns, but pass/fail is judged on the last two
 * days.
 *
 * WHY, and it is the difference between an instrument and a nuisance: the
 * question is "are the backups protecting us NOW", not "has a gap ever
 * exceeded the ceiling". Judged over the full ~100-run history, the 16.70 h
 * gap of 2026-09-07 would have failed the nightly every night for a week for a
 * one-off with a known cause and a written fix — and a board that is red every
 * night for a reason nobody can clear is a board people stop reading, which is
 * the failure this repository has already had once (`check:app-links`, sitting
 * in front of the whole nightly). A STANDING fault re-breaches on its own,
 * because new gaps keep arriving; only a resolved one ages out. Two days also
 * means a nightly shouts twice about any incident before it clears, so a
 * breach cannot slip past on one unread morning.
 */
export const BREACH_WINDOW_HOURS = 48;

/**
 * Delay of one run against the most recent slot at or before it, in hours.
 *
 * KNOWN LIMIT, and the reason the gap rather than the delay is what gets
 * judged: a run delayed past a whole interval is indistinguishable from the
 * next slot running early, and the API does not say which slot a run was
 * asked for. So a 7 h delay on the 18:00 slot reports as 1 h on the 00:00 one.
 * That under-reports congestion but cannot corrupt the RPO figure, because the
 * gap between consecutive dumps never asks which slot a run belonged to.
 */
export function delayAgainstSlot(when, scheduledHours = SCHEDULED_HOURS, scheduledMinute = SCHEDULED_MINUTE) {
  const hours = [...scheduledHours].sort((a, b) => a - b);
  const slots = hours.map((h) => {
    const slot = new Date(when);
    slot.setUTCHours(h, scheduledMinute, 0, 0);
    return slot;
  });
  // The previous day's last slot, so a run landing before the day's first one
  // is measured against yesterday rather than reporting a negative delay.
  const yesterday = new Date(slots[slots.length - 1]);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const at = [yesterday, ...slots].reverse().find((s) => s.getTime() <= when.getTime());
  return (when.getTime() - at.getTime()) / 3_600_000;
}

/**
 * The delivered cadence.
 *
 * `now` is passed in rather than read, so the "how long since the last dump"
 * figure is testable and so a caller can measure a historical window.
 */
export function summariseCadence(runTimes, now, options = {}) {
  const target = options.targetHours ?? RPO_TARGET_HOURS;
  const ceiling = options.ceilingHours ?? RPO_CEILING_HOURS;
  const silence = options.silenceHours ?? SILENCE_CEILING_HOURS;
  const window = options.windowHours ?? BREACH_WINDOW_HOURS;
  const scheduledHours = options.scheduledHours ?? SCHEDULED_HOURS;
  const scheduledMinute = options.scheduledMinute ?? SCHEDULED_MINUTE;

  const times = [...runTimes].sort((a, b) => a.getTime() - b.getTime());
  if (times.length === 0) return { measurable: false, reason: 'no successful scheduled runs found', runs: 0 };

  const delays = times.map((t) => delayAgainstSlot(t, scheduledHours, scheduledMinute));
  const gaps = [];
  for (let i = 1; i < times.length; i += 1) {
    gaps.push({
      hours: (times[i].getTime() - times[i - 1].getTime()) / 3_600_000,
      from: times[i - 1],
      to: times[i],
    });
  }

  const sinceLast = (now.getTime() - times[times.length - 1].getTime()) / 3_600_000;
  const overTarget = gaps.filter((g) => g.hours > target);
  const worst = gaps.reduce((a, b) => (b.hours > a.hours ? b : a), gaps[0] ?? { hours: 0 });

  // The verdict looks only at the last `window` hours; the figures above it
  // describe the whole sample. See BREACH_WINDOW_HOURS for why.
  const since = now.getTime() - window * 3_600_000;
  const recentGaps = gaps.filter((g) => g.to.getTime() >= since);
  const recentOverTarget = recentGaps.filter((g) => g.hours > target);
  const recentWorst = recentGaps.length
    ? recentGaps.reduce((a, b) => (b.hours > a.hours ? b : a))
    : null;

  // Silence is judged on the CURRENT gap, which no historical gap can show: a
  // workflow that stopped firing yesterday still has a perfect gap history.
  const stalled = sinceLast > silence;
  const breached = recentGaps.some((g) => g.hours > ceiling) || sinceLast > ceiling;

  return {
    measurable: true,
    runs: times.length,
    first: times[0],
    last: times[times.length - 1],
    sinceLastHours: sinceLast,
    delays: { min: Math.min(...delays), median: middle(delays), max: Math.max(...delays) },
    gaps: gaps.length
      ? { min: Math.min(...gaps.map((g) => g.hours)), median: middle(gaps.map((g) => g.hours)), max: worst.hours }
      : null,
    worstGap: gaps.length ? worst : null,
    overTargetCount: overTarget.length,
    gapCount: gaps.length,
    target,
    ceiling,
    window,
    recentGapCount: recentGaps.length,
    recentOverTargetCount: recentOverTarget.length,
    recentWorstGap: recentWorst,
    stalled,
    breached,
    verdict: stalled
      ? 'stalled'
      : breached
        ? 'breached'
        : recentOverTarget.length
          ? 'over-target'
          : 'ok',
  };
}

function middle(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function hrs(n) {
  return `${n.toFixed(2)} h`;
}

function stamp(d) {
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

function when(gap) {
  return `${hrs(gap.hours)} · ${stamp(gap.from)} → ${stamp(gap.to)} UTC`;
}

export function renderReport(summary) {
  if (!summary.measurable) return `  Backup cadence NOT MEASURED — ${summary.reason}`;
  const lines = [];
  lines.push(`  Backup cadence · ${summary.runs} successful scheduled runs`);
  lines.push(`  ${summary.first.toISOString().slice(0, 16).replace('T', ' ')} → ${summary.last.toISOString().slice(0, 16).replace('T', ' ')} UTC`);
  lines.push('');
  lines.push(`  delay vs slot   min ${hrs(summary.delays.min)}   median ${hrs(summary.delays.median)}   max ${hrs(summary.delays.max)}`);
  if (summary.gaps) {
    lines.push(`  gap between     min ${hrs(summary.gaps.min)}   median ${hrs(summary.gaps.median)}   max ${hrs(summary.gaps.max)}`);
    lines.push(`  over the ${summary.target} h target: ${summary.overTargetCount} of ${summary.gapCount}`);
    if (summary.worstGap) lines.push(`  worst was ${when(summary.worstGap)}`);
  }
  lines.push(`  since last dump: ${hrs(summary.sinceLastHours)}`);
  lines.push('');
  // The verdict names its window every time, so nobody reads a green line as a
  // claim about the whole history printed directly above it.
  lines.push(`  verdict over the last ${summary.window} h · ${summary.recentGapCount} gaps`);
  if (summary.verdict === 'stalled') {
    lines.push(`  STALLED — no successful scheduled backup for ${hrs(summary.sinceLastHours)}.`);
    lines.push('  The workflow is not running. Check Actions, the budget, and BACKUP_PASSPHRASE.');
  } else if (summary.verdict === 'breached') {
    lines.push(`  BREACHED — a gap exceeded the ${summary.ceiling} h ceiling.`);
    if (summary.recentWorstGap) lines.push(`  ${when(summary.recentWorstGap)}`);
    lines.push('  The promise has doubled. Add a slot, or move the schedule off GitHub\'s queue.');
    lines.push('  If the schedule was just edited, that is the cause: a cron change drops the');
    lines.push('  pending tick. Dispatch backup-database.yml by hand, then let it age out.');
  } else if (summary.verdict === 'over-target') {
    lines.push(`  OVER TARGET — ${summary.recentOverTargetCount} of ${summary.recentGapCount} recent gaps exceeded ${summary.target} h.`);
    lines.push('  Advisory: GitHub does not guarantee schedule times. Re-measure before');
    lines.push('  changing the documented RPO in docs/runbooks/backup-restore-drill.md.');
  } else {
    lines.push(`  OK — every gap inside the ${summary.target} h target.`);
  }
  return lines.join('\n');
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const repoArg = [...args].find((a) => a.startsWith('--repo='));
  const repo = repoArg ? repoArg.slice('--repo='.length) : process.env.GITHUB_REPOSITORY || 'ihype-org/ihype';
  const url = `https://api.github.com/repos/${repo}/actions/workflows/backup-database.yml/runs?per_page=100&status=success`;

  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'ihype-backup-cadence' };
  // A token widens the rate limit and is required for a private repo; the
  // check still works without one, so an absent token is not a failure.
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token && token.length > 20) headers.authorization = `Bearer ${token}`;

  /* Node's fetch ignores HTTPS_PROXY, and the sandboxes this is developed in
     reach the network only through one — where the same URL answers 200 under
     curl and 403 under fetch, which reads as a permissions problem and is not
     one. Same fix and same reason as `stripe-payout-rehearsal.mjs`. CI runners
     set no proxy, so this is inert there. */
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const options = { headers };
  if (proxy) {
    try {
      const { ProxyAgent } = await import('undici');
      options.dispatcher = new ProxyAgent(proxy);
    } catch {
      console.warn('  HTTPS_PROXY is set but undici is unavailable; connecting directly.');
    }
  }

  let payload;
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      console.error(`  Backup cadence NOT MEASURED — GitHub answered ${response.status} for ${repo}`);
      process.exit(2);
    }
    payload = await response.json();
  } catch (error) {
    console.error(`  Backup cadence NOT MEASURED — ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }

  const times = (payload.workflow_runs ?? [])
    .filter((r) => r.event === 'schedule' && r.conclusion === 'success')
    .map((r) => new Date(r.run_started_at))
    .filter((d) => !Number.isNaN(d.getTime()));

  const summary = summariseCadence(times, new Date());
  if (args.has('--json')) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log('');
    console.log(renderReport(summary));
    console.log('');
  }
  if (!summary.measurable) process.exit(2);
  process.exit(summary.stalled || summary.breached ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`  Backup cadence NOT MEASURED — ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  });
}
