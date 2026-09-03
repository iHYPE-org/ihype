import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every per-tab query gate covers every tab that reads its result.
 *
 * `/admin` runs only the active tab's reads: each entry in its `Promise.all`
 * is wrapped in `needs('activity', …)` and falls back to its own `.catch()`
 * value otherwise. That is invisible when it is right and silent when it is
 * wrong — a query gated for too few tabs does not error, it renders a
 * confident ZERO on the tabs it was gated out of.
 *
 * Which is not hypothetical. The change that introduced the gates shipped
 * `revenueAgg` gated on `finance` alone; Activity's metric grid renders the
 * same figure through `revenueLabel`, so it painted "REVENUE (CAPTURED)
 * $0.00" over a real number. Found by driving the page, not by reading the
 * diff, and the first version of this very check reported clean while the bug
 * sat there — see the parse guard below.
 *
 * The check is transitive: a tab that reads a DERIVED local (`revenueLabel`,
 * `funnelAlerts`, `payoutPaid`) counts as reading every query that local was
 * computed from. Direct-reference matching alone is what missed it.
 */

const PAGE = path.join(process.cwd(), 'src/app/admin/page.tsx');

const TABS = ['overview', 'activity', 'support', 'finance', 'system'] as const;

/**
 * Results of the page's first `Promise.all`, plus the three later blocks.
 * Listed here rather than parsed out of the destructuring so that a rename
 * breaks this test loudly instead of shrinking the set it checks.
 */
const QUERIES = [
  'userCount', 'profileCount', 'pendingVerificationCount', 'openReportCount',
  'openSupportCount', 'mediaCount', 'ticketOrderCount', 'recentReports',
  'recentSupport', 'pendingVerifications', 'recentEmails', 'recentAudits',
  'recentUsers', 'signupFunnelAudits', 'recentTicketOrders', 'revenueAgg',
  'recentShows', 'recentSpamFlags', 'recentLoginsCount', 'userSearchResults',
  'recentInviteCodes', 'funnelStage1', 'funnelStage2', 'funnelStage3',
  'funnelStage1Recent', 'recentSocialPosts', 'calendarShows', 'monthlyRevenue',
  'topEarners', 'payoutTotals', 'pendingAds',
];

/**
 * `health` is deliberately ungated: it has no `.catch()` to borrow a fallback
 * from, and three of the five tabs read it. Recorded here so "ungated" is a
 * decision in the test rather than an omission the test cannot tell apart.
 */
const ALWAYS_RUNS = ['health'];

function source(): string {
  return readFileSync(PAGE, 'utf8');
}

function tabBlocks(src: string): Array<[string, string]> {
  const jsx = src.slice(src.indexOf('  return ('));
  const marks = TABS.map((tab) => [jsx.indexOf(`{tab === '${tab}' && (`), tab] as const)
    .sort((a, b) => a[0] - b[0]);
  return marks.map(([start, tab], i) => [
    tab,
    jsx.slice(start, i + 1 < marks.length ? marks[i + 1][0] : jsx.length),
  ]);
}

/** Locals declared after the queries, mapped to their initialiser text. */
function derivedLocals(src: string): Map<string, string> {
  const after = src.slice(src.indexOf('] = await Promise.all'), src.indexOf('  return ('));
  const out = new Map<string, string>();
  for (const m of after.matchAll(/^ {2}const (\w+)(?:: [^=]+)? = ([\s\S]*?)(?=^ {2}const |$)/gm)) {
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
    const unreadable = QUERIES.filter(
      (name) => !new RegExp(`/\\*\\s*${name}\\s*\\*/[\\s\\S]{0,80}?needs\\(`).test(src),
    );
    expect(unreadable, 'these gates could not be parsed, so nothing about them was verified').toEqual([]);
  });

  it('gates every query for at least the tabs that read it, derived locals included', () => {
    const src = source();
    const derived = derivedLocals(src);

    const readBy = new Map<string, Set<string>>(QUERIES.map((q) => [q, new Set<string>()]));
    for (const [tab, block] of tabBlocks(src)) {
      for (const id of new Set(block.match(/\b[a-zA-Z_]\w*\b/g) ?? [])) {
        for (const q of sourcesOf(id, derived)) readBy.get(q)?.add(tab);
      }
    }

    const under: string[] = [];
    for (const name of QUERIES) {
      const gate = src.match(new RegExp(`/\\*\\s*${name}\\s*\\*/[\\s\\S]{0,80}?needs\\(([^)]*)\\)`));
      if (!gate) continue; // the test above already failed on this
      const gated = new Set([...gate[1].matchAll(/'(\w+)'/g)].map((m) => m[1]));
      const missing = [...(readBy.get(name) ?? [])].filter((t) => !gated.has(t));
      if (missing.length) {
        under.push(`${name}: read by ${[...(readBy.get(name) ?? [])].sort()}, gated for ${[...gated].sort()} — missing ${missing.sort()}`);
      }
    }
    expect(under, 'a query gated out of a tab that reads it renders a confident zero there').toEqual([]);
  });
});
