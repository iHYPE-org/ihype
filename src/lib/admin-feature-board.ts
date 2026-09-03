/**
 * Every capability the product offers a member, and whether it can work today.
 *
 * ## The question nothing else on the console answers
 *
 * `admin-workbench.ts` lists what is waiting on a human. `admin-pulse.ts` shows
 * what is happening. Neither answers "can somebody buy a ticket right now" —
 * and that is not a hypothetical gap. On 2026-09-03 every ticketed event
 * created through the app was permanently unbuyable: the creator never wrote
 * `ticketingOpensAt`, so `isTicketingOpen()` refused every sale. The console
 * showed a healthy queue, live traffic, and no work outstanding, because
 * nothing was outstanding — the feature was simply off, silently, for everyone.
 * A board of queues cannot see that. A board of capabilities can.
 *
 * ## The five states, and the one that matters
 *
 *   BLOCKED    OFFERED TO MEMBERS AND CANNOT WORK. The flag is on, so the
 *              product is advertising this, and a dependency it needs is not
 *              configured. This is the worst state on the board and sorts
 *              first — a member is being shown a door that opens onto nothing.
 *   ATTENTION  Working, with items waiting on a human. Count and age come from
 *              the workbench queues, which already own the SLA.
 *   UNKNOWN    A read failed. Never rendered as zero, never as healthy — see
 *              the null rule below.
 *   OFF        Deliberately not offered: the runtime flag is off. Not a fault,
 *              and it must still be VISIBLE, because "why can nobody upload"
 *              is answered by this row and by nothing else.
 *   IDLE       On, configured, clear, and nobody used it in the window. At
 *              alpha this is information rather than alarm, which is why it
 *              sorts below OFF and above OK.
 *   OK         On, configured, clear, and used.
 *
 * An unconfigured dependency behind a flag that is OFF is not BLOCKED. The
 * product is not offering it, so nobody can be disappointed by it, and marking
 * it red would put permanent noise at the top of the board — the failure mode
 * that got the nightly's own gate ignored on its first run.
 *
 * ## Three rules inherited on purpose
 *
 * 1. **`null` is not zero.** A flag, a count or a metric that could not be read
 *    is `null` and renders as an em dash. A console claiming `0 open reports`
 *    when the query failed is worse than one claiming nothing, because `0` is a
 *    claim an operator acts on. Same rule as `admin-workbench.ts`,
 *    `admin-pulse.ts` and `analytics-engine.ts`.
 * 2. **Activity comes from the catalogue.** `METRIC_CATALOGUE` defines each
 *    figure once. Re-deriving "uploads this week" here would be a sixth
 *    definition of a quantity that already has one, and two admin screens
 *    disagreeing with no way to tell which is right is exactly what that
 *    catalogue was built to stop.
 * 3. **Issues come from the workbench.** A capability names queue ids; it does
 *    not count rows itself. One definition of "waiting on a human", already
 *    independently caught, already carrying the promise the product makes.
 *
 * Pure and dependency-light — no `@/lib/db` import — so the unit suite and any
 * client component can load it. The reads live in `admin-feature-board-data.ts`.
 */

export type FeatureState = 'BLOCKED' | 'ATTENTION' | 'UNKNOWN' | 'OFF' | 'IDLE' | 'OK';

/** A dependency a capability needs before it can do anything. */
export type FeatureDependency =
  | 'payments'
  | 'stripe'
  | 'objectStorage'
  | 'email'
  | 'acrcloud'
  | 'ai';

export type FeatureDefinition = {
  id: string;
  /** The capability, named as the product offers it. */
  label: string;
  /** What a member actually does. One line, their words not ours. */
  member: string;
  /**
   * `core` is what iHYPE IS. `supporting` matters and is not why anyone came.
   * Ordering within a state band only.
   */
  tier: 'core' | 'supporting';
  /**
   * Runtime flags that gate this. ALL must be on for the capability to be
   * offered; one off means OFF. Empty = always on.
   */
  flags: readonly string[];
  /** Dependencies that must be configured for it to function. */
  needs: readonly FeatureDependency[];
  /** Workbench queue ids whose items belong to this capability. */
  queues: readonly string[];
  /** `METRIC_CATALOGUE` id whose value counts as "somebody used this". */
  metric?: string;
  /** The `feature-health.ts` journey the nightly proves this with. */
  journey?: string;
  /** Where an admin goes to dig in. */
  href: string;
};

/**
 * The catalogue.
 *
 * Ordered here by product shape rather than by urgency — `orderByRisk` decides
 * what the reader sees first. Keep a capability here even when it is off and
 * unconfigured: a row reading OFF and an absent row look identical while
 * scanning, and only one of them means "nobody turned this on".
 */
export const FEATURE_CATALOGUE: readonly FeatureDefinition[] = [
  {
    id: 'signup',
    label: 'Sign up',
    member: 'Create an account and get into the app',
    tier: 'core',
    flags: ['registrations_enabled'],
    needs: [],
    queues: ['access-requests'],
    metric: 'accounts',
    journey: 'join',
    href: '/admin?tab=activity#signup-funnel',
  },
  {
    id: 'invites',
    label: 'Invite gate',
    member: 'Get in with a code, or with a friend’s HYPE link',
    tier: 'supporting',
    flags: [],
    needs: [],
    queues: ['access-requests'],
    href: '/admin?tab=system#invite-codes',
  },
  {
    id: 'profiles',
    label: 'Profiles and pages',
    member: 'Build an artist, venue or fan page and edit it',
    tier: 'core',
    flags: [],
    needs: [],
    queues: ['verifications'],
    metric: 'pages',
    journey: 'profile-edit',
    href: '/admin/review?tab=verifications',
  },
  {
    id: 'uploads',
    label: 'Music uploads',
    member: 'Put a track up, with artwork, now or on a release date',
    tier: 'core',
    flags: ['uploads_enabled'],
    needs: ['objectStorage'],
    queues: ['held-tracks'],
    metric: 'uploads',
    journey: 'publish',
    href: '/admin/moderation?type=track',
  },
  {
    id: 'copyright-scan',
    label: 'Copyright scanning',
    member: 'Have an upload checked before it reaches anyone',
    tier: 'core',
    flags: ['uploads_enabled'],
    needs: ['acrcloud'],
    queues: ['held-tracks'],
    journey: 'publish',
    href: '/admin/moderation?type=track',
  },
  {
    id: 'playback',
    label: 'Playback and radio',
    member: 'Press play and hear music',
    tier: 'core',
    flags: ['radio_enabled'],
    needs: [],
    queues: [],
    metric: 'listens',
    journey: 'listen',
    href: '/admin/playlists',
  },
  {
    id: 'discovery',
    label: 'Map and discovery',
    member: 'Find acts, venues and events near me',
    tier: 'core',
    flags: ['maps_enabled'],
    needs: [],
    queues: [],
    journey: 'listen',
    href: '/admin?tab=activity',
  },
  {
    id: 'events',
    label: 'Events',
    member: 'Put on a show, and have people find it',
    tier: 'core',
    flags: [],
    needs: [],
    queues: [],
    metric: 'shows',
    journey: 'events',
    href: '/admin/tickets',
  },
  {
    id: 'ticketing',
    label: 'Ticket sales',
    member: 'Buy a ticket and get through the door',
    tier: 'core',
    flags: ['tickets_enabled', 'payments_enabled'],
    needs: ['payments'],
    queues: [],
    metric: 'tickets_sold',
    journey: 'ticketing',
    href: '/admin/tickets',
  },
  {
    id: 'payouts',
    label: 'Payouts',
    member: 'Get paid the 70/20/10 after the show',
    tier: 'core',
    flags: ['payments_enabled'],
    needs: ['stripe'],
    queues: ['payouts'],
    journey: 'payouts',
    href: '/admin/finance',
  },
  {
    id: 'advertising',
    label: 'Advertising',
    member: 'Buy a spot and have it air between songs',
    tier: 'core',
    flags: ['advertising_enabled'],
    needs: ['payments'],
    queues: ['ads'],
    metric: 'ad_impressions',
    journey: 'advertising',
    href: '/admin/ads',
  },
  {
    id: 'hype',
    label: 'HYPE economy',
    member: 'Earn HYPE for listening, attending and referring',
    tier: 'core',
    flags: [],
    needs: [],
    queues: [],
    metric: 'hypes_given',
    journey: 'hype',
    href: '/admin/growth',
  },
  {
    id: 'booking',
    label: 'Booking demand',
    member: 'Ask a venue to book an act, and have the venue see it',
    tier: 'core',
    flags: [],
    needs: [],
    queues: [],
    journey: 'booking',
    href: '/admin?tab=activity',
  },
  {
    id: 'notifications',
    label: 'Email and notifications',
    member: 'Be told when something I care about happens',
    tier: 'core',
    flags: ['outbound_email_enabled'],
    needs: ['email'],
    queues: [],
    journey: 'notifications-delivery',
    href: '/admin?tab=system#email-delivery',
  },
  {
    id: 'moderation',
    label: 'Trust and safety',
    member: 'Report something, and have it acted on',
    tier: 'core',
    flags: [],
    needs: [],
    queues: ['moderation'],
    journey: 'moderation',
    href: '/admin/moderation',
  },
  {
    id: 'support',
    label: 'Support and privacy',
    member: 'Ask for help, or for my data',
    tier: 'core',
    flags: [],
    needs: [],
    queues: ['support'],
    journey: 'account-privacy',
    href: '/admin/tickets/support',
  },
  {
    id: 'community',
    label: 'Roadmap voting',
    member: 'Vote on what gets built next',
    tier: 'supporting',
    flags: [],
    needs: [],
    queues: ['feedback'],
    journey: 'community',
    href: '/admin/feedback',
  },
  {
    id: 'ai-vetting',
    label: 'AI content vetting',
    member: 'Have images and ad spots screened before they go out',
    tier: 'supporting',
    flags: [],
    needs: ['ai'],
    queues: ['moderation'],
    href: '/admin/moderation',
  },
];

/** One queue's contribution, in the shape `admin-workbench.ts` already returns. */
export type QueueLike = {
  id: string;
  count: number;
  oldestHours: number | null;
  overdue: boolean;
};

export type FeatureBoardInput = {
  /** Flag key → on/off, or `null` when the read failed. */
  flags: Record<string, boolean | null>;
  /** Dependency → configured, or `null` when it could not be determined. */
  configured: Partial<Record<FeatureDependency, boolean | null>>;
  queues: QueueLike[];
  /** Metric id → value in the window, `null` when the read failed. */
  activity: Record<string, number | null>;
};

export type FeatureRow = {
  feature: FeatureDefinition;
  state: FeatureState;
  /** Flags that are off, by key. Empty when the capability is offered. */
  flagsOff: string[];
  /** Dependencies the capability needs and does not have. */
  missing: FeatureDependency[];
  /** Total items waiting across this capability's queues, `null` if unreadable. */
  issues: number | null;
  /** Any of its queues past its stated turnaround. */
  overdue: boolean;
  /** Oldest waiting item across its queues, in hours. */
  oldestHours: number | null;
  /** Activity in the window, `null` when unread or when it has no metric. */
  activity: number | null;
  /** Why it is in this state, in one line for the row itself. */
  reason: string;
};

const DEPENDENCY_LABEL: Record<FeatureDependency, string> = {
  payments: 'payment processing',
  stripe: 'Stripe',
  objectStorage: 'media storage',
  email: 'email delivery',
  acrcloud: 'ACRCloud',
  ai: 'the AI binding',
};

export function describeDependencies(deps: FeatureDependency[]): string {
  return deps.map((d) => DEPENDENCY_LABEL[d]).join(' and ');
}

export function buildFeatureRow(feature: FeatureDefinition, input: FeatureBoardInput): FeatureRow {
  const flagValues = feature.flags.map((key) => input.flags[key]);
  const flagUnknown = flagValues.some((value) => value === null || value === undefined);
  const flagsOff = feature.flags.filter((key) => input.flags[key] === false);

  const missing = feature.needs.filter((dep) => input.configured[dep] === false);
  const configUnknown = feature.needs.some(
    (dep) => input.configured[dep] === null || input.configured[dep] === undefined,
  );

  const rows = feature.queues.map((id) => input.queues.find((q) => q.id === id)).filter(Boolean) as QueueLike[];
  /* A named queue the reader could not produce is unknown, not empty. */
  const queuesUnreadable = feature.queues.length > 0 && rows.length < feature.queues.length;
  const issues = queuesUnreadable ? null : rows.reduce((sum, q) => sum + q.count, 0);
  const overdue = rows.some((q) => q.overdue);
  const oldestHours = rows.reduce<number | null>(
    (oldest, q) => (q.oldestHours === null ? oldest : Math.max(oldest ?? 0, q.oldestHours)),
    null,
  );

  const activity = feature.metric ? (input.activity[feature.metric] ?? null) : null;

  let state: FeatureState;
  let reason: string;

  if (flagUnknown || configUnknown) {
    state = 'UNKNOWN';
    reason = 'could not read the flag or its configuration';
  } else if (flagsOff.length > 0) {
    state = 'OFF';
    reason = `turned off (${flagsOff.join(', ')})`;
  } else if (missing.length > 0) {
    /* Offered and cannot work. The whole reason this board exists. */
    state = 'BLOCKED';
    reason = `offered to members, but ${describeDependencies(missing)} is not configured`;
  } else if (issues === null) {
    state = 'UNKNOWN';
    reason = 'could not read its queue';
  } else if (issues > 0) {
    state = 'ATTENTION';
    reason = overdue ? `${issues} waiting, past the stated turnaround` : `${issues} waiting on a human`;
  } else if (feature.metric && activity === null) {
    state = 'UNKNOWN';
    reason = 'could not read its activity';
  } else if (feature.metric && activity === 0) {
    state = 'IDLE';
    reason = 'working, and nobody used it in this window';
  } else {
    state = 'OK';
    reason = 'working';
  }

  return { feature, state, flagsOff, missing, issues, overdue, oldestHours, activity, reason };
}

const RISK_ORDER: Record<FeatureState, number> = {
  BLOCKED: 0,
  ATTENTION: 1,
  UNKNOWN: 2,
  OFF: 3,
  IDLE: 4,
  OK: 5,
};

/**
 * Worst first, and within a band the thing that has been wrong longest.
 *
 * Same tiebreak as `orderByUrgency` in `admin-workbench.ts`, and for the same
 * reason: a queue of 40 items opened this morning is less alarming than one
 * item nobody has touched for nine days, so age beats count. `core` before
 * `supporting` only when neither has age to compare.
 */
export function orderByRisk(rows: FeatureRow[]): FeatureRow[] {
  return [...rows].sort((a, b) => {
    if (RISK_ORDER[a.state] !== RISK_ORDER[b.state]) return RISK_ORDER[a.state] - RISK_ORDER[b.state];
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    const ageDelta = (b.oldestHours ?? 0) - (a.oldestHours ?? 0);
    if (ageDelta !== 0) return ageDelta;
    if (a.feature.tier !== b.feature.tier) return a.feature.tier === 'core' ? -1 : 1;
    return a.feature.label.localeCompare(b.feature.label);
  });
}

export function buildFeatureBoard(input: FeatureBoardInput): FeatureRow[] {
  return orderByRisk(FEATURE_CATALOGUE.map((feature) => buildFeatureRow(feature, input)));
}

export type FeatureBoardSummary = Record<FeatureState, number>;

export function summarizeBoard(rows: FeatureRow[]): FeatureBoardSummary {
  const summary: FeatureBoardSummary = { BLOCKED: 0, ATTENTION: 0, UNKNOWN: 0, OFF: 0, IDLE: 0, OK: 0 };
  for (const row of rows) summary[row.state] += 1;
  return summary;
}

/**
 * The one sentence at the top of the console.
 *
 * Deliberately leads with the worst thing rather than with a total: "18
 * features" is not a finding, and an operator who reads one line should read
 * the line that changes what they do next.
 */
export function headlineFor(rows: FeatureRow[]): string {
  const summary = summarizeBoard(rows);
  if (summary.BLOCKED > 0) {
    const first = rows.find((r) => r.state === 'BLOCKED');
    return summary.BLOCKED === 1
      ? `${first?.feature.label} is offered to members and cannot work`
      : `${summary.BLOCKED} features are offered to members and cannot work`;
  }
  if (summary.ATTENTION > 0) {
    const overdue = rows.filter((r) => r.state === 'ATTENTION' && r.overdue).length;
    return overdue > 0
      ? `${overdue} of ${summary.ATTENTION} features with work waiting are past their turnaround`
      : `${summary.ATTENTION} features have work waiting`;
  }
  if (summary.UNKNOWN > 0) return `${summary.UNKNOWN} features could not be read`;
  if (summary.OFF > 0) return `Everything on is working; ${summary.OFF} turned off`;
  return 'Every feature is on, configured and clear';
}
