import type { AnalyticsRange } from '@/lib/analytics-engine';

/**
 * THE ONE REAL-TIME PICTURE OF THE PLATFORM, IN SECTIONS (2026-08-14).
 *
 * The brief: every issue, statistic, trend and communication, live, and
 * organised so the console is not one long scroll on a phone.
 *
 * ## Why this is a module and not more queries in the page
 *
 * `/admin` is a 1063-line server component issuing 67 queries inline, and it
 * is the reason "add one more thing to the console" has meant "add one more
 * band to the scroll" every time. Nothing could poll it either: the figures
 * only exist inside a React render, so refreshing them meant re-rendering the
 * whole page, and re-rendering the whole page meant all 67 queries plus every
 * interactive panel. Pulling the picture out into a plain async function is
 * what makes it both **pollable** and **sectioned** — the same split
 * `analytics-engine.ts` already made for the five analytics surfaces, and for
 * the same reason.
 *
 * ## Three rules inherited on purpose
 *
 * 1. **`null` is not zero.** Every read is independently `.catch()`'d and
 *    returns `null` on failure, which the UI renders as an em dash. A console
 *    showing `0 open reports` when the query failed is worse than one showing
 *    nothing, because `0` is a claim the operator will act on. Same rule
 *    `admin-workbench.ts` and `analytics-engine.ts` already follow.
 * 2. **A section owns its own failure.** One unreachable table costs one
 *    section's figures, never the snapshot. `Promise.all` over independently
 *    guarded readers, never a bare `Promise.all` of raw queries.
 * 3. **Statistics come from the catalogue, not from here.** Trends are
 *    `METRIC_CATALOGUE` + `getAnalytics('platform', …)`, which already returns
 *    `value` and `previous` per metric. Re-deriving "accounts this month" here
 *    would be a sixth definition of a figure that already has one, and two
 *    screens disagreeing with no way to tell which is right is exactly what
 *    that catalogue was built to stop.
 *
 * ## The live window is not an analytics range
 *
 * `ANALYTICS_RANGES` starts at 7d because that is the shortest window a trend
 * is meaningful over. "Real time" needs to answer "what is happening NOW", so
 * the LIVE section computes its own 1-hour and 24-hour counts rather than
 * widening that union — adding `1h` there would offer every analytics surface
 * a range on which its month-over-month comparisons are noise.
 */

/** Sections, in the order they are presented. */
export const PULSE_SECTIONS = ['attention', 'live', 'money', 'growth', 'comms', 'system'] as const;
export type PulseSectionId = (typeof PULSE_SECTIONS)[number];

export type PulseStat = {
  id: string;
  label: string;
  /** One line saying what is actually counted. */
  help: string;
  /** `null` means could not be read. Never render it as zero. */
  value: number | null;
  /** Same measure, immediately preceding window. `null` when not comparable. */
  previous: number | null;
  unit: 'count' | 'cents' | 'percent';
};

export type PulseItem = {
  id: string;
  /** The line an operator scans. */
  label: string;
  /** Secondary line — who, when, what state. */
  detail: string;
  href?: string;
  /** Drives the dot colour: something is wrong / waiting / fine. */
  tone: 'bad' | 'warn' | 'ok';
  /** ISO timestamp, so the client can render "6m ago" in the reader's zone. */
  at: string | null;
};

export type PulseSection = {
  id: PulseSectionId;
  label: string;
  /** Glyph, never emoji — DS8 §29 bans them outright. */
  glyph: string;
  /** One line under the heading: the finding, not a label. */
  summary: string;
  /**
   * The number on the tab. `null` hides the badge rather than showing 0 —
   * a badge reading zero and a badge that could not be read look identical.
   */
  badge: number | null;
  /** True when this section is the reason to open the console right now. */
  urgent: boolean;
  stats: PulseStat[];
  items: PulseItem[];
};

export type PulseSnapshot = {
  capturedAt: string;
  /** Which analytics window the trend figures are measured over. */
  range: AnalyticsRange;
  sections: PulseSection[];
};

/**
 * Sections worth opening the console for, hardest first.
 *
 * Pure, and in the dependency-light half on purpose: `AdminPulse.tsx` is a
 * client component and imports this directly. Putting it beside the readers
 * would drag `@/lib/db` — and with it the Prisma wasm engine — into the
 * browser bundle. Same split as `analytics-engine.ts` (pure catalogue) against
 * `analytics-metrics.ts` (the queries), and `profile-stats-catalog.ts` against
 * `profile-stats.ts`, both of which say so in their own headers.
 *
 * Urgent before not; within each, the larger badge first; a section with no
 * badge sorts last among its peers rather than above them.
 */
export function orderPulseSections(sections: PulseSection[]): PulseSection[] {
  return [...sections].sort((a, b) => {
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    return (b.badge ?? -1) - (a.badge ?? -1);
  });
}
