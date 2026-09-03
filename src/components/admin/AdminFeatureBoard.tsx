import Link from 'next/link';

import { formatAge } from '@/lib/admin-workbench';
import { getFeatureBoard } from '@/lib/admin-feature-board-data';
import { headlineFor, summarizeBoard, type FeatureState } from '@/lib/admin-feature-board';

/**
 * Every capability the product offers, worst first.
 *
 * The console already had a board of QUEUES (what is waiting on a human) and a
 * board of ACTIVITY (what is happening). Neither could answer "can somebody
 * buy a ticket right now", which is how every ticketed event in the product
 * came to be unbuyable for a day while /admin showed a clear queue and normal
 * traffic. This is the third question, and it sits above the other two.
 *
 * Rendered server-side like the workbench, for the same reason: the board is
 * populated on first paint rather than flashing empty.
 */

const STATE_COPY: Record<FeatureState, { badge: string; title: string }> = {
  BLOCKED: { badge: 'Blocked', title: 'Offered to members and cannot work' },
  ATTENTION: { badge: 'Needs you', title: 'Working, with items waiting on a human' },
  UNKNOWN: { badge: 'Unknown', title: 'A read failed — this is not a claim that it is fine' },
  OFF: { badge: 'Off', title: 'Deliberately not offered: a runtime flag is off' },
  IDLE: { badge: 'Idle', title: 'On and clear, and nobody used it in this window' },
  OK: { badge: 'OK', title: 'On, configured, clear and in use' },
};

/** `null` is a dash. It is never a zero — see the module header on the lib. */
function figure(value: number | null): string {
  return value === null ? '—' : String(value);
}

export async function AdminFeatureBoard() {
  const board = await getFeatureBoard().catch(() => null);

  /* The board failing must not take the console down, and must not quietly
     render as "no features" either — an empty grid reads as good news. */
  if (!board) {
    return (
      <section className="section admin-feature-board">
        <h2 style={{ margin: 0 }}>Features</h2>
        <p className="meta" style={{ margin: '6px 0 0' }}>
          The feature board could not be built. That is a fault in the board, not a report about the product.
        </p>
      </section>
    );
  }

  const { rows, range } = board;
  const summary = summarizeBoard(rows);

  return (
    <section className="section admin-feature-board">
      <div className="admin-workbench-head">
        <div>
          <h2 style={{ margin: 0 }}>Features</h2>
          <p className="meta" style={{ margin: '4px 0 0' }}>
            {headlineFor(rows)} · activity over the last {range}
          </p>
        </div>
        <div className="admin-feature-summary">
          {(['BLOCKED', 'ATTENTION', 'UNKNOWN', 'OFF'] as const)
            .filter((state) => summary[state] > 0)
            .map((state) => (
              <span className={`admin-feature-pill admin-feature-${state.toLowerCase()}`} key={state}>
                {summary[state]} {STATE_COPY[state].badge.toLowerCase()}
              </span>
            ))}
        </div>
      </div>

      <div className="admin-feature-grid">
        {rows.map((row) => (
          <Link
            className={`admin-feature-card admin-feature-${row.state.toLowerCase()}`}
            href={row.feature.href}
            key={row.feature.id}
          >
            <div className="admin-feature-card-top">
              <span className="admin-feature-label">{row.feature.label}</span>
              <span className="admin-feature-badge" title={STATE_COPY[row.state].title}>
                {STATE_COPY[row.state].badge}
              </span>
            </div>
            <div className="admin-feature-member">{row.feature.member}</div>
            <div className="admin-feature-reason">{row.reason}</div>
            <div className="admin-feature-meta">
              {row.issues !== null && row.issues > 0 && (
                <span>
                  {row.issues} waiting
                  {row.oldestHours !== null ? ` · oldest ${formatAge(row.oldestHours)}` : ''}
                </span>
              )}
              {row.feature.metric && <span>{figure(row.activity)} in {range}</span>}
              {row.feature.journey && (
                <span
                  className="admin-feature-journey"
                  title="The nightly acceptance walk proves this capability under this journey"
                >
                  nightly: {row.feature.journey}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
