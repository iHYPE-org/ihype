/**
 * The analytics engine.
 *
 * ## Why this exists
 *
 * Every analytics surface on the site computed its own numbers inline: the fan
 * page, the artist page, the venue page, the promoter page and `/admin/growth`
 * each opened their own Prisma queries, defined their own idea of "the last 30
 * days", and named the same quantity differently. Five implementations of one
 * question is five chances for two screens to disagree about the same figure,
 * and no way to tell which one is wrong.
 *
 * This is the single definition. A metric is declared once, computed once, and
 * carries its own label and comparison, so a surface renders metrics rather
 * than re-deriving them.
 *
 * ## The two rules that shape the types
 *
 * **1. `null` is not zero.** Every metric can fail to be read — a query throws,
 * a table is unreachable — and a dashboard that renders 0 for "could not read"
 * is worse than one that renders nothing, because 0 is a claim. `value: null`
 * means unknown and must be displayed as such. This mirrors the rule
 * `admin-workbench.ts` already follows for its queue counts.
 *
 * **2. A metric knows its own audience.** "Hypes received" is meaningless to a
 * fan and central to an artist. Rather than each surface hand-picking, the
 * catalogue declares which audiences a metric serves, and a surface asks for
 * its audience. That is what "tied to user types" means here: one catalogue,
 * filtered, not four hand-maintained lists that drift.
 *
 * The DB-backed resolvers live in `analytics-metrics.ts` so this module stays
 * pure and testable — no `@/lib/db` import, and therefore importable from
 * client components and unit tests.
 */

// `all` is lifetime-to-date and exists so a surface can show a running total
// through the SAME catalogue every windowed surface uses. That is the settled
// product rule: a member sees lifetime totals, while 30-day rolling is the
// scale the platform reasons on. Without this, "keep the lifetime number"
// meant "keep a second, private implementation of the metric", which is the
// exact split that let /me/dashboard and /me/analytics show the same two
// labels with different definitions.
export const ANALYTICS_RANGES = ['7d', '30d', '90d', 'ytd', 'all'] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export function isAnalyticsRange(value: unknown): value is AnalyticsRange {
  return typeof value === 'string' && (ANALYTICS_RANGES as readonly string[]).includes(value);
}

/**
 * Who is looking. Deliberately NOT the `Role` enum: DJ is being removed
 * (`docs/dj-role-removal-scope.md`) and ADMIN is a view of the platform rather
 * than of an account, so tying this to the Prisma enum would import a
 * distinction the engine does not have and a value it should not grow.
 */
export const ANALYTICS_AUDIENCES = ['fan', 'artist', 'venue', 'advertiser', 'platform'] as const;
export type AnalyticsAudience = (typeof ANALYTICS_AUDIENCES)[number];

export type MetricUnit = 'count' | 'cents' | 'percent';

export type MetricDefinition = {
  id: string;
  label: string;
  /** One line explaining what is actually counted, shown next to the figure. */
  help: string;
  unit: MetricUnit;
  audiences: readonly AnalyticsAudience[];
};

export type Metric = MetricDefinition & {
  /** `null` means the figure could not be read — never render it as zero. */
  value: number | null;
  /** The same measure over the immediately preceding window, for comparison. */
  previous: number | null;
};

/**
 * The catalogue. Adding a metric here is what makes it available everywhere;
 * `audiences` is the only thing deciding who sees it.
 */
export const METRIC_CATALOGUE: readonly MetricDefinition[] = [
  {
    id: 'accounts',
    label: 'Accounts',
    help: 'Accounts created in this period.',
    unit: 'count',
    audiences: ['platform'],
  },
  {
    id: 'pages',
    label: 'Pages',
    help: 'Artist and venue pages created in this period.',
    unit: 'count',
    audiences: ['platform'],
  },
  {
    id: 'hypes_given',
    label: 'Hypes sent',
    help: 'Hypes you spent on artists and shows.',
    unit: 'count',
    audiences: ['fan', 'platform'],
  },
  {
    id: 'hypes_received',
    label: 'Hypes received',
    help: 'Hypes other people spent on your page.',
    unit: 'count',
    audiences: ['artist', 'venue'],
  },
  {
    id: 'listens',
    label: 'Listens',
    help: 'Track plays recorded in this period.',
    unit: 'count',
    audiences: ['fan', 'artist', 'platform'],
  },
  // The two metrics `/me/analytics` had been deriving for itself. Declaring
  // them here is the whole point of the catalogue: the fan surface was showing
  // three figures while the catalogue knew about two, so "render metrics rather
  // than re-derive them" was impossible for that page without inventing a
  // fourth private definition of a quantity other surfaces also want.
  {
    id: 'shows_attended',
    label: 'Shows attended',
    help: 'Shows you bought a ticket to that have already started.',
    unit: 'count',
    // Fan-only for now. The same quantity for an artist or venue means "people
    // who attended MY show", which is a different query against a different
    // scope — it gets its own id when a surface needs it, rather than being
    // quietly overloaded onto this one.
    audiences: ['fan'],
  },
  {
    id: 'promoter_earnings',
    label: 'Referral earned',
    help: 'Your share of the 10% promoter pool from tickets sold through your HYPE link. Attributed at sale; settlement follows the show.',
    unit: 'cents',
    audiences: ['fan'],
  },
  {
    id: 'followers',
    label: 'New followers',
    help: 'Accounts that started following in this period.',
    unit: 'count',
    audiences: ['artist', 'venue'],
  },
  {
    id: 'uploads',
    label: 'Tracks uploaded',
    help: 'Tracks added in this period, including any still in review.',
    unit: 'count',
    audiences: ['artist', 'platform'],
  },
  {
    id: 'shows',
    label: 'Shows scheduled',
    help: 'Shows whose start date falls in this period.',
    unit: 'count',
    audiences: ['artist', 'venue', 'platform'],
  },
  {
    id: 'tickets_sold',
    label: 'Tickets sold',
    help: 'Tickets on orders that were actually captured.',
    unit: 'count',
    audiences: ['artist', 'venue', 'platform'],
  },
  {
    id: 'ad_impressions',
    label: 'Ad impressions',
    help: 'Spots played to a listener in this period.',
    unit: 'count',
    audiences: ['advertiser', 'platform'],
  },
  {
    id: 'ad_spend',
    label: 'Ad spend',
    help: 'Campaign budget actually delivered against in this period.',
    unit: 'cents',
    audiences: ['advertiser', 'platform'],
  },
];

/** The metrics a given audience should see, in catalogue order. */
export function metricsForAudience(audience: AnalyticsAudience): MetricDefinition[] {
  return METRIC_CATALOGUE.filter((metric) => metric.audiences.includes(audience));
}

export function findMetric(id: string): MetricDefinition | null {
  return METRIC_CATALOGUE.find((metric) => metric.id === id) ?? null;
}

export type ResolvedRange = {
  range: AnalyticsRange;
  start: Date;
  end: Date;
  /** The immediately preceding window of the SAME length, for comparison. */
  priorStart: Date;
  priorEnd: Date;
  days: number;
  /**
   * True for `all`. A lifetime total has no preceding period to compare
   * against, so resolvers skip the prior query entirely and report `previous:
   * null` — which `deltaPercent` turns into null and `formatDelta` renders as
   * an em dash. The alternative, comparing against an empty window, would read
   * as "+100% this period" on every lifetime tile forever.
   */
  lifetime: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Turns a range into two concrete windows: the period, and the period before it.
 *
 * The prior window is the same LENGTH and ends exactly where the current one
 * begins, so the comparison is like-for-like. For `ytd` that means the same
 * number of days immediately before Jan 1 — not "last year to date", which
 * would compare a partial year against a different partial year and drift by a
 * day every leap year.
 */
export function resolveRange(range: AnalyticsRange, now: Date = new Date()): ResolvedRange {
  const end = now;
  let start: Date;

  if (range === 'all') {
    // The epoch, not the account's creation date: a resolver filters by the
    // viewer's own scope anyway, and reading a per-account floor here would
    // make every metric depend on a lookup none of them otherwise need.
    start = new Date(0);
  } else if (range === 'ytd') {
    start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  } else {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    start = new Date(end.getTime() - days * DAY_MS);
  }

  const spanMs = Math.max(DAY_MS, end.getTime() - start.getTime());
  return {
    range,
    start,
    end,
    priorStart: new Date(start.getTime() - spanMs),
    priorEnd: start,
    days: Math.round(spanMs / DAY_MS),
    lifetime: range === 'all',
  };
}

/**
 * Period-over-period change, as a percentage.
 *
 * `null` whenever the comparison would be meaningless rather than zero:
 * either figure unreadable, or a previous value of 0. Growth from nothing is
 * not "infinite percent" and is not 100% — it has no percentage, and inventing
 * one puts a number on a dashboard that cannot be defended.
 */
export function deltaPercent(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Formats a metric for display, respecting the null-is-not-zero rule. */
export function formatMetricValue(value: number | null, unit: MetricUnit): string {
  if (value === null) return '—';
  if (unit === 'cents') {
    return `$${(value / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (unit === 'percent') return `${value.toFixed(1)}%`;
  return value.toLocaleString('en-US');
}

export function formatDelta(delta: number | null): string {
  if (delta === null) return '—';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(0)}%`;
}
