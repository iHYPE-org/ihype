/**
 * Which member EXPERIENCES are working, rolled up from what the walk measured.
 *
 * ## Why this exists on top of the acceptance walk
 *
 * The walk already drives 44 items against a real Cloudflare build. What it
 * prints is a flat list of item numbers, and "item 20c failed" does not tell
 * anyone whether a member can still buy a ticket. Worse, the list can only
 * report on things it HAS: a journey nobody wrote an item for is not a quiet
 * pass, it is absent from the output entirely — which is precisely how ten
 * built components shipped mounted nowhere and nothing noticed.
 *
 * So this module answers a different question, in the member's words: can
 * someone sign up, put music up, hear it, buy a ticket, get paid. Every walk
 * item is attributed to at least one journey, and the journeys nothing proves
 * are NAMED rather than omitted.
 *
 * ## The four states, and why UNPROVEN is not a failure
 *
 *   HEALTHY    Every item that speaks for this journey ran, and passed.
 *   BROKEN     At least one failed. Something that worked does not any more.
 *   PARTIAL    What ran passed, but some of it could not run. The first draft
 *              of this module had no such state and it immediately lied:
 *              advertising showed OK on two passing items while the four that
 *              authorize, air and settle a paid spot were all blocked for want
 *              of a Stripe key. A member could not buy a spot at all, and the
 *              board said the journey was fine. A green tick over a half-run
 *              journey is worse than no board.
 *   UNPROVEN   Nothing failed, and nothing ran. Every item blocked.
 *              Payouts block every night with no Stripe key, and that is the
 *              honest state, not a defect.
 *   UNCOVERED  No item speaks for this journey at all. Standing backlog.
 *
 * Only BROKEN fails the build. A board that is red every night for a reason
 * nobody in this repository can clear is a board people stop reading — the
 * exact failure the nightly's own `check:app-links` step created on its first
 * run, where a check that could never pass sat in front of the instruments and
 * the walk never executed once. UNPROVEN and UNCOVERED are printed loudly,
 * counted in the headline, and each carries the sentence that would fix it.
 *
 * ## Overlap is deliberate
 *
 * An item may prove more than one journey. Selling a ticket is evidence for
 * ticketing AND for payouts, because the payable rows are written by the sale;
 * if it breaks, both really are affected and saying so once per journey is
 * accurate rather than noisy. What is NOT allowed is an item belonging to
 * nothing — see `orphanKeys`, which `feature-health.test.ts` asserts is empty
 * against the walk's own source.
 *
 * Keys are the walk item's LEADING TOKEN ("1b", "16 + 31", "H3", "Replay"),
 * not its prose. Rewording an item's description must not silently drop it off
 * the board; renumbering one should break the test, because that is a real
 * change of identity.
 *
 * Pure and dependency-light on purpose — no `@/lib/db` import — so the walk
 * (tsx, outside Next) and the unit suite can both load it.
 */

export type ItemStatus = 'PASS' | 'FAIL' | 'BLOCKED';
export type ItemResult = { item: string; status: ItemStatus; detail: string };

export type JourneyState = 'HEALTHY' | 'BROKEN' | 'PARTIAL' | 'UNPROVEN' | 'UNCOVERED';

export type Journey = {
  id: string;
  /** What a member is trying to do, in their words. */
  name: string;
  /**
   * `core` is what the product IS — if one of these is broken the product is
   * broken for somebody today. `supporting` matters and is not the front door.
   * Ordering only; both fail the build when broken.
   */
  tier: 'core' | 'supporting';
  /** Walk item tokens that speak for this journey. */
  keys: string[];
  /**
   * An instrument OUTSIDE the nightly walk that covers this journey. Named so
   * the board can say "proven, but not here" instead of implying a gap — and
   * so the claim is checkable by a human reading one line.
   */
  provenElsewhere?: string;
  /** What would move this off UNPROVEN or UNCOVERED. */
  toProve?: string;
};

/**
 * The leading token of a walk item name: the text before the first `.` or `:`.
 *
 * "16 + 31. Sell a ticket…" → "16 + 31"; "Replay: the same Stripe event…" →
 * "Replay"; "H3. A referral rewards…" → "H3".
 */
export function itemKey(itemName: string): string {
  const cut = itemName.search(/[.:]/);
  return (cut === -1 ? itemName : itemName.slice(0, cut)).trim();
}

export const JOURNEYS: Journey[] = [
  {
    id: 'join',
    name: 'Sign up and get in',
    tier: 'core',
    keys: ['1', '1b', '1c', '3'],
  },
  {
    id: 'auth-ceremony',
    name: 'Sign in with a passkey or a magic link',
    tier: 'core',
    keys: [],
    /* The walk seeds a session cookie directly — deliberately, because it is
       testing everything downstream of auth, not auth itself. The real
       ceremony is a browser concern and lives in the Playwright suite. */
    provenElsewhere: 'e2e/passkey.spec.ts + e2e/auth.spec.ts (full-CI, and deploy-production re-runs them)',
  },
  {
    id: 'publish',
    name: 'An artist puts music up',
    tier: 'core',
    keys: ['7', '8', '35'],
  },
  {
    id: 'listen',
    name: 'A fan finds music and plays it',
    tier: 'core',
    keys: ['9', '10/11', '21', '24', '27'],
  },
  {
    id: 'collect',
    name: 'A fan keeps music in a playlist',
    tier: 'supporting',
    keys: ['23', '25', '26'],
  },
  {
    id: 'events',
    name: 'An event gets created and listed',
    tier: 'core',
    keys: ['15'],
  },
  {
    id: 'ticketing',
    name: 'A fan buys a ticket and gets through the door',
    tier: 'core',
    keys: ['16 + 31', '19', 'Replay', '22b'],
    toProve: 'set STRIPE_TEST_SECRET_KEY and STRIPE_TEST_WEBHOOK_SECRET on the repository',
  },
  {
    id: 'refunds',
    name: 'Money comes back when a show is cancelled',
    tier: 'core',
    keys: ['17', 'R1'],
    toProve: 'set STRIPE_TEST_SECRET_KEY and STRIPE_TEST_WEBHOOK_SECRET on the repository',
  },
  {
    id: 'payouts',
    name: 'The 70/20/10 reaches real accounts',
    tier: 'core',
    /* The sale and the replay are here as well as under ticketing: the payable
       rows are written by the sale, and "one event twice pays once" is a
       payout assertion that happens to be reached through a ticket. */
    keys: ['29', '16 + 31', 'Replay', 'R1'],
    toProve: 'set STRIPE_TEST_SECRET_KEY, and onboard a third Connect account so DESTINATION mode can rehearse',
  },
  {
    id: 'fan-payment',
    name: 'A fan stores a payment method',
    tier: 'supporting',
    keys: ['28'],
    toProve: 'set STRIPE_TEST_SECRET_KEY on the repository',
  },
  {
    id: 'advertising',
    name: 'An advertiser buys a spot and it airs',
    tier: 'core',
    keys: ['20', '20b', '20c', '20d', '22', '33'],
    toProve: 'set STRIPE_TEST_SECRET_KEY on the repository',
  },
  {
    id: 'hype',
    name: 'HYPE is earned, spent and adds up',
    tier: 'core',
    keys: ['13', '30', 'H1', 'H2', 'H3', 'H4'],
  },
  {
    id: 'booking',
    name: 'Fans ask venues to book acts, and venues see it',
    tier: 'core',
    keys: ['32a', '32b', '32e', '32g', '32h'],
  },
  {
    id: 'community',
    name: 'Members vote on what gets built',
    tier: 'supporting',
    keys: ['V1'],
  },
  {
    id: 'comms',
    name: 'An owner reaches their followers',
    tier: 'supporting',
    keys: ['36'],
  },
  {
    id: 'surfaces',
    name: 'Every built surface actually renders',
    tier: 'core',
    keys: ['34'],
  },

  /* ── Journeys with nothing behind them ──────────────────────────────────
     Named on purpose. Each is a real thing a member does that no nightly
     instrument touches, and leaving them off the board would make the board
     a list of what we happen to test rather than of what the product does. */
  {
    id: 'profile-edit',
    name: 'An artist or venue edits their own page',
    tier: 'core',
    keys: [],
    toProve: 'a walk item driving PageEditor: change a section, save, read it back on the public pane',
  },
  {
    id: 'search',
    name: 'Someone searches for an act, venue or show',
    tier: 'supporting',
    keys: [],
    toProve: 'a walk item hitting /api/search for a seeded artist, venue and show',
  },
  {
    id: 'offline-ticket',
    name: 'A ticket opens at the door with no signal',
    tier: 'core',
    keys: [],
    /* Item 34 proves the component is MOUNTED. Nothing proves the service
       worker actually serves the ticket page offline, which is the only
       moment the feature exists for. */
    toProve: 'a Playwright item that warms the ticket, goes offline, and reloads the ticket page',
  },
  {
    id: 'notifications-delivery',
    name: 'A notification actually leaves the building',
    tier: 'core',
    keys: [],
    /* The walk asserts rows land in Notification and that routes resolve
       recipients; no mail provider is configured, so "sent" is never proven. */
    toProve: 'a mail-provider stub the walk can read back, or a Resend test key',
  },
  {
    id: 'account-privacy',
    name: 'A member exports or deletes their account',
    tier: 'core',
    keys: [],
    toProve: 'a walk item running the export and executeAccountErasure against a throwaway member',
  },
  {
    id: 'moderation',
    name: 'An admin acts on a report and it takes effect',
    tier: 'supporting',
    keys: [],
    toProve: 'a walk item filing a ContentReport and approving it, asserting enforceRemoval ran',
  },
];

export type JourneyHealth = {
  journey: Journey;
  state: JourneyState;
  passed: string[];
  failed: ItemResult[];
  blocked: ItemResult[];
  /** Items named by this journey that the run never reported at all. */
  missing: string[];
};

/**
 * An item the run reported that no journey claims.
 *
 * Empty is the only acceptable answer, and the test asserts it against the
 * walk's source rather than against a run — a new item must be attributed
 * before it can be merged, not after someone notices it missing from a board.
 */
export function orphanKeys(results: ItemResult[]): string[] {
  const claimed = new Set(JOURNEYS.flatMap((j) => j.keys));
  const seen = new Set(results.map((r) => itemKey(r.item)));
  return [...seen].filter((key) => !claimed.has(key)).sort();
}

/** Journey keys that name no item in the given run. */
export function unknownKeys(itemNames: string[]): string[] {
  const known = new Set(itemNames.map(itemKey));
  return JOURNEYS.flatMap((j) => j.keys).filter((key) => !known.has(key)).sort();
}

export function rollUp(results: ItemResult[]): JourneyHealth[] {
  const byKey = new Map<string, ItemResult[]>();
  for (const result of results) {
    const key = itemKey(result.item);
    byKey.set(key, [...(byKey.get(key) ?? []), result]);
  }

  return JOURNEYS.map((journey) => {
    const rows = journey.keys.flatMap((key) => byKey.get(key) ?? []);
    const passed = rows.filter((r) => r.status === 'PASS').map((r) => r.item);
    const failed = rows.filter((r) => r.status === 'FAIL');
    const blocked = rows.filter((r) => r.status === 'BLOCKED');
    const missing = journey.keys.filter((key) => !byKey.has(key));

    let state: JourneyState;
    if (journey.keys.length === 0) state = 'UNCOVERED';
    else if (failed.length > 0) state = 'BROKEN';
    else if (passed.length === 0) state = 'UNPROVEN';
    /* Blocked OR never reported — both mean this part of the journey is
       unproven, and a run that skipped an item entirely is no better evidence
       than one that blocked it. */
    else if (blocked.length > 0 || missing.length > 0) state = 'PARTIAL';
    else state = 'HEALTHY';

    return { journey, state, passed, failed, blocked, missing };
  });
}

const MARK: Record<JourneyState, string> = {
  HEALTHY: 'OK   ',
  BROKEN: 'BROKE',
  PARTIAL: 'PART ',
  UNPROVEN: '?    ',
  UNCOVERED: '—    ',
};

/**
 * The board, as text. Same string goes to the terminal and to the CI summary,
 * so the two can never describe different runs.
 */
export function renderBoard(health: JourneyHealth[]): string {
  const lines: string[] = [];
  const width = 72;

  const broken = health.filter((h) => h.state === 'BROKEN');
  const partial = health.filter((h) => h.state === 'PARTIAL');
  const unproven = health.filter((h) => h.state === 'UNPROVEN');
  const uncovered = health.filter((h) => h.state === 'UNCOVERED');
  const healthy = health.filter((h) => h.state === 'HEALTHY');

  lines.push('', '  FEATURE HEALTH — can a member do this today?', '  ' + '─'.repeat(width - 2));

  for (const tier of ['core', 'supporting'] as const) {
    const rows = health.filter((h) => h.journey.tier === tier);
    if (rows.length === 0) continue;
    lines.push(`  ${tier === 'core' ? 'CORE' : 'SUPPORTING'}`);
    for (const row of rows) {
      const unrun = row.blocked.length + row.missing.length;
      const evidence =
        row.state === 'HEALTHY'
          ? `${row.passed.length} item(s) passed`
          : row.state === 'BROKEN'
            ? `${row.failed.length} failed, ${row.passed.length} passed`
            : row.state === 'PARTIAL'
              ? `${row.passed.length} passed, ${unrun} unproven`
              : row.state === 'UNPROVEN'
                ? `${unrun} blocked, nothing ran`
                : 'nothing proves this';
      lines.push(`    ${MARK[row.state]}  ${row.journey.name.padEnd(46)} ${evidence}`);
    }
    lines.push('');
  }

  if (broken.length > 0) {
    lines.push('  BROKEN — a member could do this and now cannot:');
    for (const row of broken) {
      lines.push(`    ${row.journey.name}`);
      for (const failure of row.failed) lines.push(`      ${failure.item}\n        ${failure.detail}`);
    }
    lines.push('');
  }

  if (partial.length > 0 || unproven.length > 0) {
    lines.push('  UNPROVEN — what ran passed; this part never ran:');
    for (const row of [...partial, ...unproven]) {
      const unrun = [...row.blocked.map((b) => b.item), ...row.missing];
      lines.push(`    ${row.journey.name}${row.journey.toProve ? ` — ${row.journey.toProve}` : ''}`);
      lines.push(`      unproven: ${unrun.join(' · ')}`);
    }
    lines.push('');
  }

  if (uncovered.length > 0) {
    lines.push('  UNCOVERED — the product does this and no nightly instrument touches it:');
    for (const row of uncovered) {
      const note = row.journey.provenElsewhere
        ? `covered by ${row.journey.provenElsewhere}`
        : (row.journey.toProve ?? 'needs an item');
      lines.push(`    ${row.journey.name} — ${note}`);
    }
    lines.push('');
  }

  lines.push('  ' + '─'.repeat(width - 2));
  lines.push(
    `  ${healthy.length} healthy · ${broken.length} broken · ${partial.length} partial · ` +
      `${unproven.length} unproven · ${uncovered.length} uncovered`,
  );
  lines.push('  ' + '─'.repeat(width - 2), '');

  return lines.join('\n');
}

/** Non-zero only for a real regression. See the header for why. */
export function exitCodeFor(health: JourneyHealth[]): number {
  return health.some((h) => h.state === 'BROKEN') ? 1 : 0;
}
