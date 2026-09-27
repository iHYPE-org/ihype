import { describe, expect, it } from 'vitest';
import {
  SPLIT_AGREEMENT_VERSION,
  cancellationAmount,
  computeArtistShare,
  hashAgreementText,
  renderSplitAgreement,
  settlementDateFor,
  validateAgreementTerms,
  type SplitAgreementTerms,
} from '@/lib/split-agreement';
import { holdThreshold, isHoldEligible, paymentState, summarizeOrders, buildStatementLines } from '@/lib/settlement-statement';
import { judgeAgreementReadiness, describePayoutMethod } from '@/lib/split-agreement-data';
import { renderTextPdf, wrapText } from '@/lib/text-pdf';
import { buildPayableEntries } from '@/lib/ticket-order-state';
import { VENUE_KEEPS_ALL, carriesApplicationFee, isVenueMerchantMode } from '@/lib/settlement-mode';
import { expectedEventAccount } from '@/lib/stripe-webhook-guards';

const TERMS: SplitAgreementTerms = {
  showId: 'show_1',
  showTitle: 'The Night',
  showStartsAt: '2026-10-03T01:00:00.000Z',
  showTimeZone: 'America/New_York',
  venueName: 'The Room',
  venueAddress: '1 Main St, Portland, ME 04101',
  artistName: 'The Band',
  splitPercent: 70,
  guaranteeCents: null,
  approvedDeductions: [],
  guarantorName: null,
  juryWaiver: false,
};

describe('the signed text', () => {
  it('names the venue clock, not the runtime one, and the settlement date seven days on', () => {
    const text = renderSplitAgreement(TERMS);
    expect(text).toContain('Date: Friday, October 2, 2026, 9:00 PM (America/New_York time)');
    expect(text).toContain('Settlement Date: October 9, 2026 (7 days after the Show)');
    expect(text).toContain(`Agreement version: ${SPLIT_AGREEMENT_VERSION}`);
  });

  it('is the same string, and so the same signature, every time it is rendered', async () => {
    const a = renderSplitAgreement(TERMS);
    const b = renderSplitAgreement({ ...TERMS });
    expect(a).toBe(b);
    expect(await hashAgreementText(a)).toBe(await hashAgreementText(b));
    expect(await hashAgreementText(a)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes the hash when any term changes, so an edited offer cannot be signed as the old one', async () => {
    const base = await hashAgreementText(renderSplitAgreement(TERMS));
    for (const change of [
      { splitPercent: 71 },
      { guaranteeCents: 10_000 },
      { showStartsAt: '2026-10-10T01:00:00.000Z' },
      { showTitle: 'Another Night' },
      { juryWaiver: true },
      { guarantorName: 'Pat Owner' },
      { approvedDeductions: [{ label: 'Sound', capCents: 15_000 }] },
    ]) {
      expect(await hashAgreementText(renderSplitAgreement({ ...TERMS, ...change }))).not.toBe(base);
    }
  });

  it('includes the optional clauses only when the offer turns them on', () => {
    const off = renderSplitAgreement(TERMS);
    expect(off).toContain('3.7 Personal guaranty. Not included in this Lineup Offer.');
    expect(off).toContain('10.6 Jury waiver. Not included in this Lineup Offer.');
    const on = renderSplitAgreement({ ...TERMS, guarantorName: 'Pat Owner', juryWaiver: true, guaranteeCents: 50_000 });
    expect(on).toContain('3.7 Personal guaranty. Pat Owner, the person named as guarantor');
    expect(on).toContain('10.6 Jury waiver. To the extent permitted by law');
    expect(on).toContain('Guarantee: $500.00');
  });

  it('keeps the counsel-approved clauses that protect the artist', () => {
    const text = renderSplitAgreement(TERMS);
    for (const clause of ['3.3 Held in trust.', '3.4 No setoff.', '3.5 No circumvention.', '4.4 Card fees are the Venue\'s cost.', '8.3 Collection costs', '1.3 iHYPE is not a party to the payment.', '10.5 iHYPE is not a defendant.']) {
      expect(text).toContain(clause);
    }
  });

  it('refuses terms nobody could sign', () => {
    expect(validateAgreementTerms({ ...TERMS, splitPercent: 0 })).not.toBeNull();
    expect(validateAgreementTerms({ ...TERMS, splitPercent: 101 })).not.toBeNull();
    expect(validateAgreementTerms({ ...TERMS, guaranteeCents: -1 })).not.toBeNull();
    expect(validateAgreementTerms({ ...TERMS, approvedDeductions: [{ label: '', capCents: 1 }] })).not.toBeNull();
    expect(validateAgreementTerms(TERMS)).toBeNull();
  });
});

describe('the Artist Share (Section 4)', () => {
  it('reproduces the worked example in 4.2 to the cent', () => {
    const share = computeArtistShare({
      grossThroughIhypeCents: 189_900,
      taxCents: 9_900,
      refundsCents: 7_200,
      chargebacksLostCents: 0,
      offPlatformCents: 0,
      approvedDeductionsCents: 0,
      splitPercent: 70,
      guaranteeCents: null,
    });
    expect(share.netCents).toBe(172_800);
    expect(share.artistShareCents).toBe(120_960);
  });

  it('pays the guarantee when the split falls short, and gives the rounding cent to the artist', () => {
    expect(computeArtistShare({ grossThroughIhypeCents: 1000, taxCents: 0, refundsCents: 0, chargebacksLostCents: 0, offPlatformCents: 0, approvedDeductionsCents: 0, splitPercent: 50, guaranteeCents: 20_000 }).artistShareCents).toBe(20_000);
    expect(computeArtistShare({ grossThroughIhypeCents: 1001, taxCents: 0, refundsCents: 0, chargebacksLostCents: 0, offPlatformCents: 0, approvedDeductionsCents: 0, splitPercent: 50, guaranteeCents: null }).artistShareCents).toBe(501);
  });

  it('counts admission sold outside iHYPE and takes off only the capped deductions', () => {
    const lines = buildStatementLines({
      orders: { ticketsSold: 10, ticketsRefunded: 0, grossCents: 20_000, taxCents: 0, refundsCents: 0 },
      offPlatformCents: 5_000,
      chargebacksLostCents: 0,
      cancelled: false,
      agreements: [{ id: 'a', artistName: 'Band', splitPercent: 50, guaranteeCents: null, deductionCapCents: 1_000, deductionsAppliedCents: 9_999 }],
    });
    expect(lines.grossCents).toBe(25_000);
    expect(lines.netCents).toBe(25_000);
    expect(lines.lines[0].deductionsAppliedCents).toBe(1_000);
    expect(lines.lines[0].artistShareCents).toBe(12_000);
  });

  it('owes a venue-cancelled show the greater of the guarantee and half the share (7.3)', () => {
    expect(cancellationAmount({ grossAtCancellationCents: 10_000, taxCents: 0, splitPercent: 80, guaranteeCents: null })).toBe(4_000);
    expect(cancellationAmount({ grossAtCancellationCents: 10_000, taxCents: 0, splitPercent: 80, guaranteeCents: 6_000 })).toBe(6_000);
  });
});

describe('the Settlement Statement', () => {
  it('counts refunded tickets as sold-then-refunded, taking the face value once and the tax once', () => {
    const summary = summarizeOrders([
      { status: 'CAPTURED', quantity: 2, subtotalCents: 3_600, totalTaxCents: 198, chargedAt: new Date(), refundedAt: null },
      { status: 'VOID', quantity: 1, subtotalCents: 1_800, totalTaxCents: 99, chargedAt: new Date(), refundedAt: new Date() },
      { status: 'RESERVED', quantity: 4, subtotalCents: 7_200, totalTaxCents: 396, chargedAt: null, refundedAt: null },
      { status: 'VOID', quantity: 1, subtotalCents: 1_800, totalTaxCents: 99, chargedAt: null, refundedAt: null },
    ]);
    expect(summary).toEqual({ ticketsSold: 3, ticketsRefunded: 1, grossCents: 5_697, taxCents: 297, refundsCents: 1_800 });
  });

  it('completes a marked payment only when the artist confirms or five days pass without a report (5.3)', () => {
    const show = new Date('2026-10-01T00:00:00Z');
    const marked = new Date('2026-10-05T00:00:00Z');
    const base = { showStartsAt: show, paidMarkedAt: marked, artistConfirmedAt: null, reportedAt: null, reportResolvedAt: null };
    expect(paymentState({ ...base, now: new Date('2026-10-07T00:00:00Z') })).toBe('MARKED_PAID');
    expect(paymentState({ ...base, now: new Date('2026-10-10T00:00:01Z') })).toBe('COMPLETE');
    expect(paymentState({ ...base, now: new Date('2026-10-10T00:00:01Z'), reportedAt: marked })).toBe('REPORTED');
    expect(paymentState({ ...base, paidMarkedAt: null, now: new Date('2026-10-09T00:00:01Z') })).toBe('OVERDUE');
    expect(paymentState({ ...base, paidMarkedAt: null, now: new Date('2026-09-30T00:00:00Z') })).toBe('NOT_DUE');
  });

  it('makes a venue pausable only 14 days after the settlement date, on a report still open (8.6)', () => {
    const show = new Date('2026-10-01T00:00:00Z');
    expect(settlementDateFor(show).toISOString()).toBe('2026-10-08T00:00:00.000Z');
    expect(holdThreshold(show).toISOString()).toBe('2026-10-22T00:00:00.000Z');
    const reported = { showStartsAt: show, reportedAt: new Date('2026-10-09T00:00:00Z'), reportResolvedAt: null };
    expect(isHoldEligible({ ...reported, now: new Date('2026-10-21T00:00:00Z') })).toBe(false);
    expect(isHoldEligible({ ...reported, now: new Date('2026-10-23T00:00:00Z') })).toBe(true);
    expect(isHoldEligible({ ...reported, reportResolvedAt: new Date(), now: new Date('2026-10-23T00:00:00Z') })).toBe(false);
  });
});

describe('who may sell', () => {
  it('needs an offer, and every act signed on a current agreement', () => {
    expect(judgeAgreementReadiness([])).toMatchObject({ ready: false, code: 'NO_OFFER' });
    expect(judgeAgreementReadiness([
      { status: 'ACCEPTED', profileName: 'A', hasAgreement: true },
      { status: 'PENDING', profileName: 'B', hasAgreement: false },
    ])).toMatchObject({ ready: false, pendingActs: ['B'] });
    expect(judgeAgreementReadiness([{ status: 'ACCEPTED', profileName: 'A', hasAgreement: false }])).toMatchObject({ ready: false });
    expect(judgeAgreementReadiness([{ status: 'ACCEPTED', profileName: 'A', hasAgreement: true }])).toEqual({ ready: true });
  });

  it('writes the payment method into words an agreement can carry, and nothing without details', () => {
    expect(describePayoutMethod('PAYMENT_APP', 'Venmo @band')).toBe('Payment app: Venmo @band');
    expect(describePayoutMethod('CHECK', '  ')).toBeNull();
    expect(describePayoutMethod(null, 'x')).toBeNull();
  });
});

describe('the venue keeps every sale', () => {
  it('writes no payable at all for a VENUE_KEEPS_ALL order — iHYPE holds none of it', () => {
    const entries = buildPayableEntries(
      { id: 'show_1', venueProfileId: 'v', headlinerProfileId: 'a', artistPayoutPercent: 75 },
      {
        id: 'o', affiliatePromoterProfileId: null, taxLocalCents: 10, taxStateCents: 10, taxCountryCents: 0, taxInternationalCents: 0,
        venuePayoutCents: 2000, artistPayoutCents: 0, promoterPayoutCents: 0, settlementMode: VENUE_KEEPS_ALL, settlementAccountId: 'acct_v',
      },
      [],
    );
    expect(entries).toEqual([]);
  });

  it('scopes its Stripe events and refunds to the venue account, with no application fee to return', () => {
    expect(isVenueMerchantMode(VENUE_KEEPS_ALL)).toBe(true);
    expect(carriesApplicationFee(VENUE_KEEPS_ALL)).toBe(false);
    expect(carriesApplicationFee('VENUE_DIRECT')).toBe(true);
    expect(expectedEventAccount({ settlementMode: VENUE_KEEPS_ALL, settlementAccountId: 'acct_v' })).toBe('acct_v');
  });
});

describe('the PDF copy', () => {
  it('is a well-formed PDF whose cross-reference offsets point at its objects', () => {
    const text = renderSplitAgreement(TERMS);
    const bytes = renderTextPdf(text, 'iHYPE Show Revenue Split Agreement');
    const pdf = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    const xrefAt = Number(pdf.match(/startxref\n(\d+)/)![1]);
    expect(pdf.slice(xrefAt, xrefAt + 4)).toBe('xref');
    const offsets = [...pdf.slice(xrefAt).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    offsets.forEach((offset, i) => expect(pdf.slice(offset).startsWith(`${i + 1} 0 obj`)).toBe(true));
    expect(Number(pdf.match(/\/Count (\d+)/)![1])).toBeGreaterThan(1);
  });

  it('wraps long lines without dropping a word', () => {
    const line = 'word '.repeat(60).trim();
    const wrapped = wrapText(line, 40);
    expect(wrapped.length).toBeGreaterThan(1);
    expect(wrapped.join(' ').split(/\s+/).length).toBe(60);
  });
});
