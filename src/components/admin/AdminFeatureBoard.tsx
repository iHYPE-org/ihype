import Link from 'next/link';

import { formatAge } from '@/lib/admin-workbench';
import { getFeatureBoard } from '@/lib/admin-feature-board-data';
import { headlineFor, summarizeBoard, type FeatureRow, type FeatureState } from '@/lib/admin-feature-board';

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

function FeatureCard({ row, range }: { row: FeatureRow; range: string }) {
  return (
    <Link
      className={`admin-feature-card admin-feature-${row.state.toLowerCase()}`}
      href={row.feature.href}
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
  );
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
  const needsDecision = (state: FeatureState) => state === 'BLOCKED' || state === 'ATTENTION' || state === 'UNKNOWN';
  const open = rows.filter((row) => needsDecision(row.state));
  const rest = rows.filter((row) => !needsDecision(row.state));

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

      {/* Worst first, and only the worst OPEN. On a 393px phone the full board
          measured 2,957px — eighteen cards, most of them saying "working" —
          before the operator reached anything they could act on. The rows that
          need a decision (BLOCKED, ATTENTION, UNKNOWN) render as cards; the
          rest are one tap away under a summary that already carries their
          count, so a board that is all green is one line tall. Every card is
          still in the document in worst-first order, which is what the e2e
          asserts; a closed <details> hides, it does not remove. */}
      {open.length > 0 ? (
        <div className="admin-feature-grid">{open.map((row) => <FeatureCard key={row.feature.id} row={row} range={range} />)}</div>
      ) : (
        <p className="admin-feature-clear">No feature needs a decision right now.</p>
      )}
      {rest.length > 0 && (
        <details className="admin-feature-rest">
          <summary className="admin-feature-rest-summary">
            <span>{rest.length} more {rest.length === 1 ? 'feature is' : 'features are'} on and clear</span>
            <span className="admin-feature-rest-counts">
              {(['OFF', 'IDLE', 'OK'] as const)
                .filter((state) => summary[state] > 0)
                .map((state) => `${summary[state]} ${STATE_COPY[state].badge.toLowerCase()}`)
                .join(' · ')}
            </span>
          </summary>
          <div className="admin-feature-grid">{rest.map((row) => <FeatureCard key={row.feature.id} row={row} range={range} />)}</div>
        </details>
      )}
    </section>
  );
}
