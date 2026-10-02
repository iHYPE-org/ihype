import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { maskComments } from '../../../scripts/lib/mask-comments.mjs';

/**
 * Every per-tab query gate names EXACTLY the tabs that read its result.
 *
 * `/admin` runs only the active tab's reads: each read is wrapped in
 * `needs('activity', …)` and falls back to its own `.catch()` value
 * otherwise. That is invisible when it is right and silent when it is wrong,
 * in both directions:
 *
 * - A query gated for too FEW tabs does not error, it renders a confident
 *   ZERO on the tabs it was gated out of. The change that introduced the gates
 *   shipped `revenueAgg` gated on `finance` alone; Activity's metric grid
 *   renders the same figure through `revenueLabel`, so it painted "REVENUE
 *   (CAPTURED) $0.00" over a real number. Found by driving the page, not by
 *   reading the diff, and the first version of this very check reported clean
 *   while the bug sat there — see the parse guard below.
 *
 * - A query gated for too MANY tabs renders nothing wrong at all; the extra
 *   tab simply pays for a read it never draws, which is the whole cost the
 *   gates exist to remove. `pendingVerifications` stayed gated for Overview
 *   for weeks after the "Needs attention" panel that read it there was folded
 *   into the routine board (2026-09-05), because this check looked one way.
 *
 * The check is transitive: a tab that reads a DERIVED local (`revenueLabel`,
 * `funnelAlerts`, `payoutPaid`, `featureFlags`) counts as reading every query
 * that local was computed from. Direct-reference matching alone is what
 * missed it.
 *
 * Reads are scanned over code with comments and string literals BLANKED, and
 * the `/* name *\/` markers are read from the raw source. A marker on its own
 * line above `const betaMetrics = …` would otherwise be swallowed into the
 * previous local's initialiser and read as a dependency, and an i18n key such
 * as `'adminPage.betaMetrics'` would register as a read on whichever tab names
 * it — the scanner-reads-its-own-prose trap `mask-comments.mjs` exists for.
 */

const PAGE = path.join(process.cwd(), 'src/app/admin/page.tsx');

const TABS = ['overview', 'activity', 'support', 'finance', 'system'] as const;

/**
 * Every gated read the page runs: the first `Promise.all`, the finance/ads
 * block, the eleven runtime flags behind the System tab's board, and the four
 * standalone reads. Listed here rather than parsed out of the destructuring
 * so that a rename breaks this test loudly instead of shrinking the set it
 * checks.
 */
const QUERIES = [
  'pulse',
  'userCount', 'profileCount', 'pendingVerificationCount', 'openReportCount',
  'openSupportCount', 'mediaCount', 'ticketOrderCount', 'recentReports',
  'recentSupport', 'pendingVerifications', 'recentEmails', 'recentAudits',
  'recentUsers', 'signupFunnelAudits', 'recentTicketOrders', 'revenueAgg',
  'recentShows', 'recentSpamFlags', 'recentLoginsCount', 'userSearchResults',
  'recentInviteCodes', 'funnelStage1', 'funnelStage2', 'funnelStage3',
  'funnelStage1Recent', 'recentSocialPosts', 'calendarShows', 'monthlyRevenue',
  'topEarners', 'payoutTotals', 'pendingAds',
  'inviteOnlySignupEnabled', 'inviteCodeSharingEnabled', 'databaseMediaFallbackEnabled',
  'registrationsEnabled', 'uploadsEnabled', 'outboundEmailEnabled', 'advertisingEnabled',
  'paymentsEnabled', 'ticketsEnabled', 'radioEnabled', 'mapsEnabled',
  'rateLimitMetrics', 'betaMetrics',
];

/**
 * `health` is deliberately ungated. It is read by Overview (the reserved
 * unpaid-orders alert) and System (the Launch health panel) and by no other
 * tab, but it has no `.catch()` to borrow a fallback from — the snapshot
 * answers `degraded` from inside its own try — and System's panel reads
 * `health.status` directly, so a null stand-in on the other three tabs would
 * be a JSX change rather than a scheduling one. Recorded here so "ungated" is
 * a decision in the test rather than an omission the test cannot tell apart;
 * the moment it gains a gate it belongs in `QUERIES` so both directions are
 * checked.
 */
const ALWAYS_RUNS = ['health'];

function source(): string {
  return readFileSync(PAGE, 'utf8');
}

/** Blank the inside of quoted string literals, keeping offsets and the quotes. */
function maskStrings(src: string): string {
  return src.replace(/(['"])(?:(?!\1)[^\\\n]|\\.)*\1/g, (lit) => lit[0] + ' '.repeat(lit.length - 2) + lit[0]);
}

/** The page with every comment and string literal blanked, same offsets. */
function code(): string {
  return maskStrings(maskComments(source()));
}

/**
 * Each tab's JSX block, sliced out of `masked`. The boundaries are found on
 * the RAW source, because `{tab === 'overview' && (` carries its tab name in a
 * string literal and the masked copy has blanked it; both have the same
 * offsets, so a boundary found on one slices the other. A page with no blocks
 * is refused rather than scanned as empty, which is exactly what the first
 * masked version of this test did — and reported every gate clean.
 */
function tabBlocks(masked: string): Array<[string, string]> {
  const raw = source();
  expect(raw.length, 'masked and raw source must share offsets').toBe(masked.length);
  const marks = TABS.map((tab) => [raw.indexOf(`{tab === '${tab}' && (`), tab] as const)
    .sort((a, b) => a[0] - b[0]);
  expect(marks.every(([start]) => start > raw.indexOf('  return (')), 'every tab block must be found inside the JSX').toBe(true);
  return marks.map(([start, tab], i) => [
    tab,
    masked.slice(start, i + 1 < marks.length ? marks[i + 1][0] : masked.length),
  ]);
}

/**
 * Locals declared after the queries, mapped to their WHOLE initialiser text.
 * The terminator is the next top-level `const` or the end of the slice — not
 * `$`, which under the `m` flag is the end of the first LINE, so an earlier
 * version captured `funnelAlerts = [` and `featureFlags = [` as one line each
 * and followed none of their dependencies.
 */
function derivedLocals(src: string): Map<string, string> {
  const after = src.slice(src.indexOf('] = await Promise.all'), src.indexOf('  return ('));
  const out = new Map<string, string>();
  for (const m of after.matchAll(/^ {2}const (\w+)(?:: [^=]+)? = ([\s\S]*?)(?=^ {2}const |(?![\s\S]))/gm)) {
    out.set(m[1], m[2]);
  }
  return out;
}

/** Which raw query results an identifier depends on, following derived locals. */
function sourcesOf(name: string, derived: Map<string, string>, seen = new Set<string>()): Set<string> {
  if (seen.has(name)) return new Set();
  seen.add(name);
  if (QUERIES.includes(name)) return new Set([name]);
  const init = derived.get(name);
  if (!init) return new Set();
  const out = new Set<string>();
  for (const id of new Set(init.match(/\b[a-zA-Z_]\w*\b/g) ?? [])) {
    for (const s of sourcesOf(id, derived, seen)) out.add(s);
  }
  return out;
}

/** The tabs each query is read by, through the tab blocks and derived locals. */
function readers(masked: string): Map<string, Set<string>> {
  const derived = derivedLocals(masked);
  const readBy = new Map<string, Set<string>>(QUERIES.map((q) => [q, new Set<string>()]));
  for (const [tab, block] of tabBlocks(masked)) {
    for (const id of new Set(block.match(/\b[a-zA-Z_]\w*\b/g) ?? [])) {
      for (const q of sourcesOf(id, derived)) readBy.get(q)?.add(tab);
    }
  }
  return readBy;
}

/** The tabs a query's `needs()` gate names, read off the RAW source's marker. */
function gateOf(raw: string, name: string): Set<string> | null {
  const gate = raw.match(new RegExp(`/\\*\\s*${name}\\s*\\*/[\\s\\S]{0,80}?needs\\(([^)]*)\\)`));
  return gate ? new Set([...gate[1].matchAll(/'(\w+)'/g)].map((m) => m[1])) : null;
}

describe('the /admin per-tab query gates', () => {
  it('names every query it means to check', () => {
    const src = source();
    for (const name of [...QUERIES, ...ALWAYS_RUNS]) {
      expect(new RegExp(`\\b${name}\\b`).test(src), `${name} is no longer in the page`).toBe(true);
    }
  });

  /*
   * The guard on the guard. The first version of this check could not find a
   * single `/* name *\/` marker — its regex was wrong — and it reported every
   * gate clean, which is worse than not having run it. So an unparseable gate
   * FAILS rather than being skipped.
   */
  it('can read every gate — an unreadable one fails rather than passing', () => {
    const src = source();
    const unreadable = QUERIES.filter((name) => gateOf(src, name) === null);
    expect(unreadable, 'these gates could not be parsed, so nothing about them was verified').toEqual([]);
  });

  it('gates every query for at least the tabs that read it, derived locals included', () => {
    const src = source();
    const readBy = readers(code());

    const under: string[] = [];
    for (const name of QUERIES) {
      const gated = gateOf(src, name);
      if (!gated) continue; // the test above already failed on this
      const missing = [...(readBy.get(name) ?? [])].filter((t) => !gated.has(t));
      if (missing.length) {
        under.push(`${name}: read by ${[...(readBy.get(name) ?? [])].sort()}, gated for ${[...gated].sort()} — missing ${missing.sort()}`);
      }
    }
    expect(under, 'a query gated out of a tab that reads it renders a confident zero there').toEqual([]);
  });

  it('gates no query for a tab that does not read it — that tab would pay for a read it never draws', () => {
    const src = source();
    const readBy = readers(code());

    const over: string[] = [];
    for (const name of QUERIES) {
      const gated = gateOf(src, name);
      if (!gated) continue;
      const read = readBy.get(name) ?? new Set<string>();
      const extra = [...gated].filter((t) => !read.has(t));
      if (extra.length) {
        over.push(`${name}: gated for ${[...gated].sort()}, read by ${[...read].sort()} — ${extra.sort()} pays for nothing`);
      }
    }
    expect(over, 'a query gated for a tab that never renders it is a read that tab pays for and never draws').toEqual([]);
  });

  /*
   * The scanner must not read its own prose. Both halves above depend on the
   * read scan ignoring comments and string literals; a scanner that counted
   * them would report the marker above `const betaMetrics` as a dependency of
   * `rateLimitMetrics`, and an i18n key as a read. Proved by construction
   * rather than assumed.
   */
  it('scans reads over masked code — a comment or a string naming a query is not a read', () => {
    const masked = code();
    expect(masked.length).toBe(source().length);
    expect(masked.includes('/* betaMetrics */')).toBe(false);
    expect(masked.includes("'adminPage.betaMetrics'")).toBe(false);
    expect(masked.includes('{betaMetrics &&')).toBe(true);
  });

  it('every query is actually read somewhere — a read nothing renders is not a gate, it is dead', () => {
    const readBy = readers(code());
    const unread = QUERIES.filter((name) => (readBy.get(name)?.size ?? 0) === 0);
    expect(unread, 'no tab block reads these, so no gate could be right for them').toEqual([]);
  });

  it('the always-run reads carry no gate — one that gains a gate belongs in QUERIES', () => {
    const src = source();
    for (const name of ALWAYS_RUNS) {
      expect(gateOf(src, name), `${name} has acquired a needs() gate; move it into QUERIES so both directions are checked`).toBeNull();
    }
    /* The decision rests on WHO reads `health`; if a third tab starts to, or
       one stops, the reasoning above has to be re-read rather than inherited. */
    const masked = code();
    const derived = derivedLocals(masked);
    const dependsOnHealth = (id: string, seen = new Set<string>()): boolean => {
      if (id === 'health') return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return [...new Set(derived.get(id)?.match(/\b[a-zA-Z_]\w*\b/g) ?? [])].some((inner) => dependsOnHealth(inner, seen));
    };
    const healthReaders = tabBlocks(masked)
      .filter(([, block]) => [...new Set(block.match(/\b[a-zA-Z_]\w*\b/g) ?? [])].some((id) => dependsOnHealth(id)))
      .map(([tab]) => tab);
    expect(healthReaders.sort()).toEqual(['overview', 'system']);
  });
});
