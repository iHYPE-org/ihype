import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { maskComments } from '../../../scripts/lib/mask-comments.mjs';
import {
  CONNECT_PAYOUT_CATEGORIES,
  PAYOUT_HOLD_DAYS,
  describePayableRelease,
  isConnectPayoutCategory,
  payoutHoldEndsAt,
  stalledPayoutWhere,
} from '../payout-release';
import { payoutReleaseLabel } from '../i18n-enum-labels';

const NOW = new Date('2026-09-15T12:00:00.000Z');
const day = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

function entry(over: Partial<Parameters<typeof describePayableRelease>[0]> = {}) {
  return {
    category: 'ARTIST_PAYOUT',
    hasPayoutDestination: true,
    show: { status: 'ENDED', startsAt: day(-30) },
    ...over,
  };
}

describe('describePayableRelease', () => {
  it('a tax entry is never released automatically, whatever the show did', () => {
    for (const category of ['TAX_LOCAL', 'TAX_STATE', 'TAX_COUNTRY', 'TAX_INTERNATIONAL']) {
      expect(describePayableRelease(entry({ category }), NOW)).toEqual({ kind: 'manual-remittance' });
    }
  });

  it('a payee with no Connect account is waiting on themselves, not on the show', () => {
    // The blocker order is the point: a profile with no destination is skipped
    // on every run for ever, so it must beat "the show has not ended yet".
    expect(describePayableRelease(entry({ hasPayoutDestination: false }), NOW).kind).toBe('no-destination');
    expect(
      describePayableRelease(
        entry({ hasPayoutDestination: false, show: { status: 'SCHEDULED', startsAt: day(30) } }),
        NOW,
      ).kind,
    ).toBe('no-destination');
  });

  it('a show that has not ended is awaiting the show', () => {
    for (const status of ['DRAFT', 'SCHEDULED', 'LIVE', 'CANCELED']) {
      expect(describePayableRelease(entry({ show: { status, startsAt: day(-30) } }), NOW).kind)
        .toBe('awaiting-show');
    }
  });

  it('an ended show inside the hold reports the day the hold lifts', () => {
    const startsAt = day(-3);
    const state = describePayableRelease(entry({ show: { status: 'ENDED', startsAt } }), NOW);
    expect(state.kind).toBe('holding');
    if (state.kind !== 'holding') throw new Error('unreachable');
    expect(state.releasesOn.toISOString()).toBe(payoutHoldEndsAt(startsAt).toISOString());
    expect(state.releasesOn.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it('the hold boundary is exclusive at exactly the hold length and due one ms later', () => {
    // A payable whose hold ends on this very instant has not yet been paid by
    // the cron (its filter is `startsAt <= now - HOLD`), so the member should
    // read "due", not "held until now".
    const exact = new Date(NOW.getTime() - PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000);
    expect(describePayableRelease(entry({ show: { status: 'ENDED', startsAt: exact } }), NOW).kind).toBe('due');
    const oneMsShort = new Date(exact.getTime() + 1);
    expect(describePayableRelease(entry({ show: { status: 'ENDED', startsAt: oneMsShort } }), NOW).kind)
      .toBe('holding');
  });

  it('an unreadable show is unknown rather than a promise', () => {
    expect(describePayableRelease(entry({ show: null }), NOW)).toEqual({ kind: 'unknown' });
  });

  it('every state renders a sentence, and none of them says "once the show ends"', () => {
    const t = (_key: string, fallback?: string) => fallback ?? '';
    const kinds = ['manual-remittance', 'no-destination', 'awaiting-show', 'holding', 'due', 'unknown'];
    for (const kind of kinds) {
      const text = payoutReleaseLabel(t, kind, { releasesOn: '25 Sep 2026', holdDays: PAYOUT_HOLD_DAYS });
      expect(text.length).toBeGreaterThan(10);
      expect(text).not.toContain('{');
      // The sentence this module exists to delete.
      expect(text.toLowerCase()).not.toContain('once the show ends');
    }
  });
});

describe('the promise and the payout cron read the same conditions', () => {
  const cron = fs.readFileSync(path.join(process.cwd(), 'src/lib/show-payouts.ts'), 'utf8');

  it('show-payouts imports the constants rather than restating them', () => {
    expect(cron).toContain("from '@/lib/payout-release'");
    // Two copies of "when does a payable pay" is how the stale sentence
    // survived the day PAYOUT_HOLD_DAYS was introduced.
    expect(cron).not.toMatch(/const\s+PAYOUT_HOLD_DAYS\s*=/);
    expect(cron).not.toMatch(/const\s+CONNECT_PAYOUT_CATEGORIES\s*(:|=)/);
  });

  it('the cron still filters on every condition the member-facing states name', () => {
    expect(cron).toContain('PAYOUT_HOLD_DAYS');
    expect(cron).toContain('CONNECT_PAYOUT_CATEGORIES');
    expect(cron).toMatch(/profileId:\s*\{\s*not:\s*null\s*\}/);
    expect(cron).toMatch(/status:\s*'ENDED'/);
    expect(cron).toContain('stripeConnectAccountId');
  });

  it('the cron pays on FINISHED onboarding, not on an account id existing', () => {
    /* `connect/onboard` writes `stripeConnectAccountId` the moment Stripe
       creates the account, before the member has completed a screen of the
       hosted flow — so an id exists for everyone who ever pressed the button
       and wandered off. Paying on it sent a real transfer to an account with
       no active transfers capability, every day, for ever, and emailed the
       administrators each time. `describePayableRelease` judges the same
       flag, so what a member is told and what the run pays agree. */
    /* MASKED, because the comment explaining this gate names the flag — and a
       scanner that reads its own documentation is the failure this repository
       has now shipped four times. The first draft of this assertion passed
       with the gate deleted, on the strength of the prose above it. */
    const code = maskComments(cron);
    expect(code).toMatch(/if\s*\(!connectAccountId\s*\|\|\s*!entry\.profile\?\.stripeConnectOnboarded\)/);
    /* And the skipped entry is still REPORTED. Gating in the `where` instead
       would have been the tidier-looking fix and would have made these
       payables invisible again — which is the whole of what the block after
       the loop was written to fix. They have to be selected to be counted. */
    const gate = code.search(/if\s*\(!connectAccountId\s*\|\|/);
    expect(code.slice(gate, gate + 400)).toContain('noDestination.push');
  });

  it('the cron orders its batch, so the cap is a queue and not an arbitrary 200', () => {
    /* `take` without `orderBy` lets Postgres return any 200 of the matching
       rows, and it need not return the same 200 twice — so past the cap an
       entry can be passed over run after run while every run reports
       success. */
    const code = maskComments(cron);
    const take = code.indexOf('take: 200');
    expect(take).toBeGreaterThan(0);
    expect(code.slice(0, take)).toMatch(/orderBy:\s*\{\s*createdAt:\s*'asc'\s*\}/);
  });

  it('only the three transferable categories are connect categories', () => {
    expect([...CONNECT_PAYOUT_CATEGORIES].sort())
      .toEqual(['ARTIST_PAYOUT', 'PROMOTER_AFFILIATE', 'VENUE_PAYOUT']);
    expect(isConnectPayoutCategory('TAX_LOCAL')).toBe(false);
    expect(isConnectPayoutCategory('ARTIST_PAYOUT')).toBe(true);
  });
});

describe('stalledPayoutWhere — what the operator is shown as overdue', () => {
  it('excludes a payable still inside the dispute hold', () => {
    // The defect: the queue counted every PENDING entry on an ENDED show
    // against a 24h promise, so it was overdue from the moment the show
    // ended, for ten days, by design — on a board sorted worst-first.
    const w = stalledPayoutWhere(NOW);
    const cutoff = w.show.startsAt.lte;
    expect(cutoff.getTime()).toBe(NOW.getTime() - PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000);
    // A show that ended yesterday started after the cutoff, so it is excluded.
    expect(day(-1).getTime()).toBeGreaterThan(cutoff.getTime());
    // One that started before the hold window is included.
    expect(day(-PAYOUT_HOLD_DAYS - 1).getTime()).toBeLessThan(cutoff.getTime());
  });

  it('never counts a tax entry, which nothing automated ever releases', () => {
    const cats = stalledPayoutWhere(NOW).category.in;
    expect([...cats].sort()).toEqual(['ARTIST_PAYOUT', 'PROMOTER_AFFILIATE', 'VENUE_PAYOUT']);
    for (const tax of ['TAX_LOCAL', 'TAX_STATE', 'TAX_COUNTRY', 'TAX_INTERNATIONAL']) {
      expect(cats).not.toContain(tax);
    }
  });

  it('DOES include a payable with no payout destination — that is the point', () => {
    // The cron skips those silently; this where-clause is the complement of
    // the cron, not a copy of it, so it must NOT filter on a Connect account.
    // Filtering here would hide the one case that never resolves by itself.
    expect(JSON.stringify(stalledPayoutWhere(NOW))).not.toContain('stripeConnect');
    expect(JSON.stringify(stalledPayoutWhere(NOW))).not.toContain('profile');
  });

  it('only ever selects PENDING and ENDED', () => {
    const w = stalledPayoutWhere(NOW);
    expect(w.status).toBe('PENDING');
    expect(w.show.status).toBe('ENDED');
  });
});

describe('a payable nobody can be paid is not silent', () => {
  const cron = fs.readFileSync(path.join(process.cwd(), 'src/lib/show-payouts.ts'), 'utf8');

  it('the no-destination branch reaches Sentry through log.error', () => {
    // `skipped` used to go only into a JSON body the scheduled invocation
    // discards, while the transfer-failure branch twenty lines above logged
    // AND emailed. A failed transfer was loud; a payee who can never be paid
    // was silent, and the second is the one that persists.
    expect(cron).toContain('noDestination');
    const tail = cron.slice(cron.indexOf('noDestination.length > 0'));
    expect(tail).toContain('log.error');
    // Named payees, so an operator knows who to chase.
    expect(tail).toContain('payees');
  });

  it('reports once per run, not once per entry', () => {
    // A hundred payables owed to three profiles is three problems.
    const loop = cron.slice(cron.indexOf('for (const entry of entries)'), cron.indexOf('noDestination.length > 0'));
    expect(loop).not.toContain('log.error(\n      \'[show-payouts]\', null, `no Stripe');
    expect(cron.match(/noDestination\.length > 0/g)).toHaveLength(1);
  });
});
