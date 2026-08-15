'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  orderPulseSections,
  type PulseSection,
  type PulseSnapshot,
  type PulseStat,
} from '@/lib/admin-pulse';

/**
 * THE CONSOLE'S LIVE BOARD (2026-08-14).
 *
 * Six sections, one at a time, refreshing themselves. The brief was "every
 * issue, statistic, trend and communication, real time, and not a total scroll
 * job" — so the shape is a tab strip rather than another band added to the
 * page, and the strip is what makes it usable on a phone.
 *
 * ## Why the sections are TABS and not collapsed cards
 *
 * A card that opens still lives in a column, so opening the fourth one still
 * means scrolling past three. Tabs are the only arrangement where the number
 * of sections stops mattering to the distance travelled — which is the actual
 * complaint being fixed, and the reason this cannot just be more `<details>`.
 * The strip itself scrolls sideways when it overruns, the same behaviour and
 * for the same reason as `.mmm-map-chips`.
 *
 * ## The refresh has to be visible or it cannot be trusted
 *
 * An operations console that silently shows stale numbers is worse than one
 * that admits it: the whole value of the board is that the figure on it is
 * true NOW. So the age of the snapshot is always on screen, it counts up
 * rather than sitting at "just now", and a failed poll says so and keeps the
 * last good snapshot rather than blanking or, worse, rendering zeros.
 *
 * ## Polling stops when nobody is looking
 *
 * `document.hidden` gates the interval. A console left open in a background
 * tab overnight would otherwise be ~4,300 requests, each doing real database
 * work, for a screen nobody is reading — and would burn the endpoint's rate
 * limit for the moment it IS read. Coming back to the tab refreshes at once,
 * so the first thing seen is current.
 */

const POLL_MS = 20_000;

type Props = {
  /** Rendered on the server so the board is populated on first paint. */
  initial: PulseSnapshot;
};

function formatValue(stat: PulseStat): string {
  // `null` is not zero: it means the figure could not be read. An em dash is
  // the whole point — a console that prints 0 for a failed query states
  // something false, and an operator acts on it.
  if (stat.value === null) return '—';
  if (stat.unit === 'cents') {
    return `$${(stat.value / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }
  if (stat.unit === 'percent') return `${stat.value}%`;
  return stat.value.toLocaleString('en-US');
}

/**
 * The trend chip.
 *
 * Returns null unless BOTH figures are real. A "+100%" derived from a previous
 * period of zero is noise, and a delta against a period that could not be read
 * is a fabrication.
 */
function trendOf(stat: PulseStat): { label: string; direction: 'up' | 'down' | 'flat' } | null {
  if (stat.value === null || stat.previous === null) return null;
  if (stat.previous === 0) return null;
  const delta = ((stat.value - stat.previous) / stat.previous) * 100;
  if (!Number.isFinite(delta)) return null;
  const rounded = Math.round(delta);
  if (rounded === 0) return { label: 'level', direction: 'flat' };
  return {
    label: `${rounded > 0 ? '+' : ''}${rounded}%`,
    direction: rounded > 0 ? 'up' : 'down',
  };
}

function relativeTime(iso: string | null, now: number): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function AdminPulse({ initial }: Props) {
  const [snapshot, setSnapshot] = useState<PulseSnapshot>(initial);
  const [active, setActive] = useState<string>(() => orderPulseSections(initial.sections)[0]?.id ?? 'attention');
  const [staleError, setStaleError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Ticks once a second purely so the "updated 14s ago" line counts up. Kept
  // separate from the poll so the age is honest between polls rather than
  // jumping from "just now" to "20s ago".
  const [now, setNow] = useState(() => Date.now());
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      const response = await fetch(`/api/admin/pulse?range=${encodeURIComponent(snapshot.range)}`, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const next = (await response.json()) as PulseSnapshot;
      setSnapshot(next);
      setStaleError(null);
    } catch (error) {
      // Keep the last good snapshot. Blanking the board on a dropped poll
      // would turn a momentary network blip into "the platform is empty".
      setStaleError(error instanceof Error ? error.message : 'refresh failed');
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, [snapshot.range]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const poll = setInterval(() => {
      if (!document.hidden) void refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const sections = useMemo(() => orderPulseSections(snapshot.sections), [snapshot.sections]);
  const current = sections.find((section) => section.id === active) ?? sections[0];
  const age = relativeTime(snapshot.capturedAt, now);

  return (
    <section className="pulse" aria-label="Platform pulse">
      <header className="pulse-head">
        <div>
          <h2 className="pulse-title">Pulse</h2>
          <p className="pulse-age">
            {staleError
              ? `Showing the last good read — refresh failed (${staleError})`
              : `Updated ${age || 'just now'}${refreshing ? ' · refreshing' : ''}`}
          </p>
        </div>
        <button type="button" className="pulse-refresh" onClick={() => void refresh()} disabled={refreshing}>
          Refresh
        </button>
      </header>

      {/* Sideways-scrolling strip: the number of sections must not decide how
          far a thumb travels. role=tablist so the arrow keys and the screen
          reader get the relationship the visual already implies. */}
      <div className="pulse-tabs" role="tablist" aria-label="Pulse sections">
        {sections.map((section) => (
          <button
            key={section.id}
            role="tab"
            type="button"
            id={`pulse-tab-${section.id}`}
            aria-selected={section.id === current?.id}
            aria-controls={`pulse-panel-${section.id}`}
            className="pulse-tab"
            data-urgent={section.urgent || undefined}
            data-active={section.id === current?.id || undefined}
            onClick={() => setActive(section.id)}
          >
            <span aria-hidden="true" className="pulse-tab-glyph">{section.glyph}</span>
            {section.label}
            {/* A badge is only drawn for a real, non-zero count — a badge
                reading 0 and a badge that could not be read look the same. */}
            {section.badge !== null && <span className="pulse-tab-badge">{section.badge}</span>}
          </button>
        ))}
      </div>

      {current && (
        <div
          role="tabpanel"
          id={`pulse-panel-${current.id}`}
          aria-labelledby={`pulse-tab-${current.id}`}
          className="pulse-panel"
        >
          <p className="pulse-summary" data-urgent={current.urgent || undefined}>{current.summary}</p>
          <PulseStats section={current} />
          <PulseItems section={current} now={now} />
        </div>
      )}
    </section>
  );
}

function PulseStats({ section }: { section: PulseSection }) {
  if (section.stats.length === 0) return null;
  return (
    <div className="pulse-stats">
      {section.stats.map((stat) => {
        const trend = trendOf(stat);
        return (
          <div key={stat.id} className="pulse-stat" title={stat.help}>
            <div className="pulse-stat-value">
              {formatValue(stat)}
              {trend && (
                <span className="pulse-stat-trend" data-direction={trend.direction}>
                  {trend.label}
                </span>
              )}
            </div>
            <div className="pulse-stat-label">{stat.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function PulseItems({ section, now }: { section: PulseSection; now: number }) {
  if (section.items.length === 0) {
    return <p className="pulse-empty">Nothing to show here right now.</p>;
  }
  return (
    <ul className="pulse-items">
      {section.items.map((item) => {
        const body = (
          <>
            <span className="pulse-item-dot" data-tone={item.tone} aria-hidden="true" />
            <span className="pulse-item-text">
              <span className="pulse-item-label">{item.label}</span>
              <span className="pulse-item-detail">{item.detail}</span>
            </span>
            {item.at && <time className="pulse-item-at" dateTime={item.at}>{relativeTime(item.at, now)}</time>}
          </>
        );
        return (
          <li key={item.id} className="pulse-item">
            {item.href ? (
              <Link href={item.href} className="pulse-item-link">{body}</Link>
            ) : (
              <span className="pulse-item-link">{body}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
