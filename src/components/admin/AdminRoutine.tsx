'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  SCHEDULE_CADENCE_ORDER,
  describeSchedule,
  dutiesFor,
  type AutomatedJobRow,
  type OperatorCadence,
  type RoutineBoard,
  type RoutineDutyRow,
  type ScheduleCadence,
} from '@/lib/admin-routine';

/**
 * The routine board: Daily · Weekly · Monthly · Automated, one at a time.
 *
 * Tabs rather than four stacked lists for the reason `AdminPulse` gives — the
 * number of sections must not decide how far a thumb travels, and this replaces
 * a grid of eight cards that measured 1,204px on a 393px phone. The default
 * tab is the one with work in it, so opening the console on a quiet day lands
 * on "Daily · clear" and on a bad day lands on the thing that is late.
 *
 * Every row is the same 44px-floored shape: a label, one line of note, and a
 * status word at the right. A queue row links to its queue; a reading duty
 * with nowhere to go is a plain row; a scheduled job is never a link, because
 * its path needs the cron secret and an operator clicking it gets a 401.
 */

type Tab = OperatorCadence | 'automated';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'automated', label: 'Automated' },
];

const STATUS_WORD: Record<RoutineDutyRow['status'], string> = {
  overdue: 'Overdue',
  due: 'Due',
  waiting: 'Waiting',
  info: 'Read',
  clear: 'Clear',
};

const CADENCE_HEADING: Record<ScheduleCadence, string> = {
  daily: 'Every day',
  weekly: 'Every week',
  monthly: 'Every month',
  continuous: 'Around the clock',
};

function needsYou(rows: RoutineDutyRow[]): number {
  return rows.filter((r) => r.status === 'overdue' || r.status === 'due' || r.status === 'waiting').length;
}

function relative(at: number, now: number): string {
  const hours = Math.max(0, (now - at) / 36e5);
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m ago`;
  if (hours < 48) return `${Math.round(hours)}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function liveness(job: AutomatedJobRow, now: number): { word: string; tone: 'ok' | 'warn' | 'mute' } {
  if (!job.aliveKey) return { word: 'not tracked', tone: 'mute' };
  if (!job.liveness || job.liveness.kind === 'unknown') return { word: '—', tone: 'mute' };
  if (job.liveness.kind === 'stale') return { word: 'no recent run', tone: 'warn' };
  return { word: `ran ${relative(job.liveness.at, now)}`, tone: 'ok' };
}

export function AdminRoutine({ board }: { board: RoutineBoard }) {
  const [tab, setTab] = useState<Tab>(() => {
    for (const cadence of ['daily', 'weekly', 'monthly'] as const) {
      if (needsYou(dutiesFor(board, cadence)) > 0) return cadence;
    }
    return 'daily';
  });
  // The server's clock, carried in the board: relative times computed against
  // the client's clock would differ by the hydration gap and mismatch.
  const now = board.now;

  return (
    <div className="routine" data-testid="admin-routine">
      <div className="routine-tabs" role="tablist" aria-label="Routine">
        {TABS.map((entry) => {
          const badge = entry.id === 'automated'
            ? board.automated.filter((j) => j.liveness?.kind === 'stale').length
            : needsYou(dutiesFor(board, entry.id));
          const active = entry.id === tab;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              id={`routine-tab-${entry.id}`}
              aria-selected={active}
              aria-controls={`routine-panel-${entry.id}`}
              className="routine-tab"
              data-active={active || undefined}
              data-urgent={(!active && badge > 0) || undefined}
              onClick={() => setTab(entry.id)}
            >
              <span className="routine-tab-label">{entry.label}</span>
              {badge > 0 && <span className="routine-tab-badge" aria-label={`${badge} needing you`}>{badge}</span>}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`routine-panel-${tab}`} aria-labelledby={`routine-tab-${tab}`} className="routine-panel">
        {tab === 'automated' ? <AutomatedList board={board} now={now} /> : <DutyList rows={dutiesFor(board, tab)} />}
      </div>
    </div>
  );
}

function DutyList({ rows }: { rows: RoutineDutyRow[] }) {
  if (rows.length === 0) return <p className="routine-empty">Nothing on this cadence.</p>;
  return (
    <ul className="routine-list">
      {rows.map((row) => {
        const body = (
          <>
            <span className="routine-row-text">
              <span className="routine-row-label">{row.label}</span>
              <span className="routine-row-note" title={row.detail}>{row.note}</span>
            </span>
            <span className="routine-row-status" data-status={row.status}>
              {row.count !== null && row.count > 0 ? <strong>{row.count}</strong> : null}
              {STATUS_WORD[row.status]}
            </span>
          </>
        );
        return (
          <li key={row.id} className="routine-row" data-status={row.status}>
            {row.href ? (
              row.href.startsWith('http') ? (
                <a className="routine-row-link" href={row.href} target="_blank" rel="noreferrer">{body}</a>
              ) : (
                <Link className="routine-row-link" href={row.href}>{body}</Link>
              )
            ) : (
              <span className="routine-row-link">{body}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function AutomatedList({ board, now }: { board: RoutineBoard; now: number }) {
  return (
    <>
      <p className="routine-lede">
        These run themselves. Read the result; do not do the work by hand.
      </p>
      <ul className="routine-list">
        {board.workflows.map((wf) => (
          <li key={wf.file} className="routine-row" data-kind="workflow">
            <a className="routine-row-link" href={wf.href} target="_blank" rel="noreferrer">
              <span className="routine-row-text">
                <span className="routine-row-label">{wf.label} <span className="routine-row-when">{describeSchedule(wf.schedule)}</span></span>
                <span className="routine-row-note" title={wf.what}>{wf.what}</span>
              </span>
              <span className="routine-row-status" data-tone="mute">GitHub ›</span>
            </a>
          </li>
        ))}
      </ul>
      {SCHEDULE_CADENCE_ORDER.map((cadence) => {
        const jobs = board.automated.filter((j) => j.cadence === cadence);
        if (jobs.length === 0) return null;
        return (
          <details key={cadence} className="routine-group" open={cadence === 'daily'}>
            <summary className="routine-group-summary">
              <span>{CADENCE_HEADING[cadence]}</span>
              <span className="routine-group-count">{jobs.length} jobs</span>
            </summary>
            <ul className="routine-list">
              {jobs.map((job) => {
                const live = liveness(job, now);
                return (
                  <li key={job.path} className="routine-row" data-kind="job">
                    <span className="routine-row-link">
                      <span className="routine-row-text">
                        <span className="routine-row-label">{job.label} <span className="routine-row-when">{job.scheduleText}</span></span>
                        <span className="routine-row-note" title={job.what}>{job.what}</span>
                      </span>
                      <span className="routine-row-status" data-tone={live.tone}>{live.word}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </>
  );
}

