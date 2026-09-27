/**
 * THE SHOW REVENUE SPLIT AGREEMENT (2026-09-27, DESIGN_SYNC row 528; owner,
 * after counsel reviewed the text: "Lawyer agrees. Complete agreement" and
 * "Go live with it now").
 *
 * Ticket money goes 100% to the venue's own Stripe account and the venue pays
 * each act its share directly, under this agreement. One agreement is formed
 * per act per show: the venue signs by sending the Lineup Offer, the act signs
 * by accepting it. iHYPE is not a party to the payment and holds nothing.
 *
 * ## The text is data, and the signature is a hash of it
 *
 * `renderSplitAgreement()` is the ONLY place the words are assembled. Both
 * signers are shown its output, and what each signs is the SHA-256 of that
 * exact string (`hashAgreementText`). The accept route re-renders from the
 * stored offer terms and refuses a hash that does not match what the act was
 * shown, so an offer edited between viewing and signing cannot be signed.
 *
 * Change any sentence and bump `SPLIT_AGREEMENT_VERSION`: agreements already
 * signed keep their stored text, and new ones carry the new version. The
 * wording is counsel-approved; do not edit it for style.
 *
 * AMENDED 2026-09-27 (version .2, owner: "No tickets are to be sold without a
 * completed agreement between venue and artist(s) with exact split per
 * ticket, cancellation terms (venue is responsible for lost ticket sale fees
 * to Stripe, Artist responsible if they don't show up)"): the Lineup Offer
 * states the ticket price and the act's exact amount per ticket, 7.3 puts
 * every fee Stripe keeps on a venue cancellation's refunds on the venue, and
 * 7.4 makes an act that cancels or does not appear reimburse those fees. The
 * medical carve-out 7.4 carried in version .1 is gone with it; 7.5 (events
 * outside either party's control) still applies to both. These are the
 * owner's terms, not counsel's; counsel has not reviewed version .2.
 *
 * Section 12 of the drafting document (the acceptance record) is deliberately
 * NOT part of the signed text: it describes what the app stores, not a term
 * between the parties. `ShowSplitAgreement` is that record.
 *
 * Pure: no database — imported by routes, the page and the tests.
 */

export const SPLIT_AGREEMENT_VERSION = '2026-09-27.2';

/** The Settlement Date is this many days after the Show (Section 2). */
export const SETTLEMENT_DAYS_AFTER_SHOW = 7;
/** A payment the venue marks is complete after this many days unless the act reports a problem (5.3). */
export const PAYMENT_AUTO_CONFIRM_DAYS = 5;
/** iHYPE may pause a venue this many days after the Settlement Date on an unresolved report (8.6). */
export const NON_PAYMENT_PAUSE_DAYS = 14;
/** The venue adds off-platform sales within this many hours of the Show (6.2). */
export const OFF_PLATFORM_REPORT_HOURS = 48;
/** At most this many Approved Deductions on one offer. */
export const MAX_APPROVED_DEDUCTIONS = 5;

export type ApprovedDeduction = { label: string; capCents: number };

export type SplitAgreementTerms = {
  showId: string;
  showTitle: string;
  /** ISO instant the Show starts. */
  showStartsAt: string;
  /** The venue's IANA zone, when known. */
  showTimeZone: string | null;
  venueName: string;
  venueAddress: string | null;
  artistName: string;
  /** Face value of one ticket, in cents, before tax. Null when the Show sells no tickets through iHYPE. */
  ticketPriceCents: number | null;
  splitPercent: number;
  guaranteeCents: number | null;
  approvedDeductions: ApprovedDeduction[];
  /** Section 3.7 applies only when a guarantor is named. */
  guarantorName: string | null;
  /** Section 10.6 applies only when turned on. */
  juryWaiver: boolean;
};


export function settlementDateFor(showStartsAt: Date | string): Date {
  const start = typeof showStartsAt === 'string' ? new Date(showStartsAt) : showStartsAt;
  return new Date(start.getTime() + SETTLEMENT_DAYS_AFTER_SHOW * 24 * 60 * 60 * 1000);
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * The wall-clock parts of an instant in a zone, as NUMBERS. The agreement's
 * words are assembled from these by hand rather than by Intl's formatter,
 * because the text is hashed and a signature must survive a runtime whose ICU
 * spells a date differently (a narrow no-break space before "PM", "GMT-4" for
 * "EDT") — a different string is a different contract.
 */
function wallClock(date: Date, timeZone: string | null) {
  const zone = timeZone ?? 'UTC';
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
    }).formatToParts(date);
  } catch {
    return wallClock(date, 'UTC');
  }
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour') % 24;
  const minute = get('minute');
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return { year, month, day, hour, minute, weekday, zone: timeZone ?? 'UTC' };
}

function formatShowDate(iso: string, timeZone: string | null): string {
  const c = wallClock(new Date(iso), timeZone);
  const h12 = c.hour % 12 === 0 ? 12 : c.hour % 12;
  const ampm = c.hour < 12 ? 'AM' : 'PM';
  return `${WEEKDAYS[c.weekday]}, ${MONTHS[c.month - 1]} ${c.day}, ${c.year}, ${h12}:${String(c.minute).padStart(2, '0')} ${ampm} (${c.zone} time)`;
}

function formatDay(date: Date, timeZone: string | null): string {
  const c = wallClock(date, timeZone);
  return `${MONTHS[c.month - 1]} ${c.day}, ${c.year}`;
}

/** Whole dollars and cents without Intl's grouping, for the same reason. */
function plainUsd(cents: number): string {
  const whole = Math.floor(cents / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `$${whole}.${String(cents % 100).padStart(2, '0')}`;
}

/**
 * What the Artist receives from each ticket sold at the stated price: the
 * Split Percentage of the face value (tax is never shared), rounded to the
 * nearest cent with a half cent going to the Artist (Section 4.3). This is
 * the "exact split per ticket" the Lineup Offer states (owner, 2026-09-27).
 */
export function artistCentsPerTicket(ticketPriceCents: number, splitPercent: number): number {
  return Math.round((ticketPriceCents * splitPercent) / 100 + 1e-9);
}

/** Refuses terms no signer could agree to, before any text is shown. */
export function validateAgreementTerms(terms: SplitAgreementTerms): string | null {
  if (!Number.isInteger(terms.splitPercent) || terms.splitPercent < 1 || terms.splitPercent > 100) {
    return 'The split percentage must be a whole number from 1 to 100.';
  }
  if (terms.guaranteeCents !== null && (!Number.isInteger(terms.guaranteeCents) || terms.guaranteeCents <= 0)) {
    return 'A guarantee must be a positive amount.';
  }
  if (terms.approvedDeductions.length > MAX_APPROVED_DEDUCTIONS) {
    return `An offer can list at most ${MAX_APPROVED_DEDUCTIONS} approved deductions.`;
  }
  for (const d of terms.approvedDeductions) {
    if (!d.label.trim() || d.label.length > 80) return 'Each approved deduction needs a short description.';
    if (!Number.isInteger(d.capCents) || d.capCents <= 0) return 'Each approved deduction needs a fixed amount or cap.';
  }
  if (terms.guarantorName !== null && !terms.guarantorName.trim()) return 'Name the guarantor, or leave the guaranty off.';
  if (terms.ticketPriceCents !== null && (!Number.isInteger(terms.ticketPriceCents) || terms.ticketPriceCents <= 0)) {
    return 'The ticket price must be a positive amount.';
  }
  return null;
}

/**
 * The full text both parties are shown and sign. Deterministic: the same
 * terms always produce the same string, which is what makes the hash a
 * signature.
 */
export function renderSplitAgreement(terms: SplitAgreementTerms): string {
  const settlement = settlementDateFor(terms.showStartsAt);
  const deductions = terms.approvedDeductions.length
    ? terms.approvedDeductions.map((d) => `  - ${d.label.trim()}: up to ${plainUsd(d.capCents)}`).join('\n')
    : '  None';

  const offer = [
    'LINEUP OFFER',
    `Show: ${terms.showTitle}`,
    `iHYPE show ID: ${terms.showId}`,
    `Date: ${formatShowDate(terms.showStartsAt, terms.showTimeZone)}`,
    `Venue: ${terms.venueName}${terms.venueAddress ? `, ${terms.venueAddress}` : ''}`,
    `Artist: ${terms.artistName}`,
    `Split Percentage: ${terms.splitPercent}% of Net Ticket Receipts`,
    ...(terms.ticketPriceCents !== null
      ? [
        `Ticket price: ${plainUsd(terms.ticketPriceCents)} per ticket, plus sales tax`,
        `Artist Share of each ticket sold: ${plainUsd(artistCentsPerTicket(terms.ticketPriceCents, terms.splitPercent))} (${terms.splitPercent}% of ${plainUsd(terms.ticketPriceCents)}; sales tax is not shared, and Stripe's card fee is the Venue's cost and does not reduce this amount)`,
      ]
      : ['Ticket price: this Show sells no tickets through iHYPE']),
    `Guarantee: ${terms.guaranteeCents !== null ? plainUsd(terms.guaranteeCents) : 'None'}`,
    'Approved Deductions:',
    deductions,
    `Personal guaranty (Section 3.7): ${terms.guarantorName ? `Yes, by ${terms.guarantorName.trim()}` : 'Not included'}`,
    `Jury waiver (Section 10.6): ${terms.juryWaiver ? 'Included' : 'Not included'}`,
    `Settlement Date: ${formatDay(settlement, terms.showTimeZone)} (${SETTLEMENT_DAYS_AFTER_SHOW} days after the Show)`,
    `Agreement version: ${SPLIT_AGREEMENT_VERSION}`,
  ].join('\n');

  const guaranty = terms.guarantorName
    ? `3.7 Personal guaranty. ${terms.guarantorName.trim()}, the person named as guarantor in the Lineup Offer, as owner or principal of the Venue, personally and unconditionally guarantees payment of the Artist Share, and agrees the Artist may enforce this guaranty without first pursuing the Venue.`
    : '3.7 Personal guaranty. Not included in this Lineup Offer.';

  const juryWaiver = terms.juryWaiver
    ? '10.6 Jury waiver. To the extent permitted by law, both parties waive trial by jury for claims under this Agreement.'
    : '10.6 Jury waiver. Not included in this Lineup Offer.';

  const guaranteeDefinition = terms.guaranteeCents !== null
    ? `- Guarantee: ${plainUsd(terms.guaranteeCents)}, the minimum amount stated in the Lineup Offer that the Artist is paid whether or not the Split Percentage reaches it.`
    : '- Guarantee: none in this Lineup Offer.';

  return [
    'iHYPE SHOW REVENUE SPLIT AGREEMENT',
    '',
    offer,
    '',
    'This agreement makes the venue legally responsible for paying each artist their agreed share of ticket sales. All ticket money goes to the venue\'s own Stripe account; iHYPE never holds, routes or guarantees it.',
    '',
    'It is formed in the iHYPE app, once per artist per show: the venue sends a lineup offer with the artist\'s share, and the artist accepts it. Each accepted offer is a separate, binding contract between that venue and that artist.',
    '',
    'Clauses marked Optional apply only when the Lineup Offer turns them on.',
    '',
    '1. PARTIES AND iHYPE\'S ROLE',
    '',
    '1.1 Parties. This Agreement is between the venue named in the Lineup Offer ("Venue") and the artist or act named in the Lineup Offer ("Artist"). If the Artist is a band or group, the person accepting represents that they are authorized to accept for every member, and payment to the account the Artist designates satisfies the Venue\'s obligation to all members.',
    '',
    '1.2 Venue\'s authority. The person accepting for the Venue represents that they are authorized to bind the Venue, and that the Stripe account connected to the Venue\'s iHYPE profile belongs to the Venue.',
    '',
    '1.3 iHYPE is not a party to the payment. iHYPE provides the software used to form this Agreement, sell tickets and record sales. iHYPE does not receive, hold, transmit or guarantee ticket money or the Artist Share, is not an agent, escrow agent or fiduciary of either party, and has no obligation to pay the Artist.',
    '',
    '1.4 iHYPE as third-party beneficiary. iHYPE may rely on and enforce Sections 1.3, 8.6 and 10.5. No other right is given to iHYPE, and no obligation is placed on it.',
    '',
    '2. DEFINITIONS',
    '',
    '- Show: the performance identified in the Lineup Offer, by title, venue, date and iHYPE show ID, including any rescheduled date under Section 7.',
    '- Lineup Offer: the offer sent by the Venue in the iHYPE app, stating the Show, the Artist\'s Split Percentage and any Guarantee. Its terms, as accepted, are part of this Agreement.',
    '- Gross Ticket Receipts: all amounts paid by buyers for admission to the Show, however and wherever sold, including tickets sold at the door or through any channel other than iHYPE.',
    '- Excluded Amounts: only these: (a) sales tax the Venue collects and remits, (b) refunds actually paid to buyers under Section 7, and (c) chargebacks the Venue actually loses.',
    '- Net Ticket Receipts: Gross Ticket Receipts minus Excluded Amounts. No other cost, fee or expense of the Venue is deducted, including card-processing fees, staffing, rent, production, marketing or bar costs, unless it is listed in the Lineup Offer as an Approved Deduction with a fixed amount or cap.',
    '- Split Percentage: the percentage of Net Ticket Receipts stated for the Artist in the Lineup Offer.',
    guaranteeDefinition,
    '- Artist Share: the greater of (a) the Split Percentage × Net Ticket Receipts and (b) the Guarantee, if any.',
    '- Settlement Statement: the per-show report generated by iHYPE under Section 6.',
    `- Settlement Date: ${SETTLEMENT_DAYS_AFTER_SHOW} days after the Show.`,
    '',
    '3. VENUE COLLECTS; VENUE MUST PAY',
    '',
    '3.1 Collection. The Venue collects all Gross Ticket Receipts into its own account. The Artist authorizes this and does not need a Stripe or iHYPE payment account.',
    '',
    '3.2 Unconditional obligation. The Venue shall pay the Artist Share by the Settlement Date. This obligation is not conditioned on the Venue\'s profitability, bar sales, other expenses, or on any dispute with any other artist, promoter or iHYPE.',
    '',
    '3.3 Held in trust. The Venue receives the Artist Share portion of Net Ticket Receipts in trust for the Artist and holds it for the Artist\'s benefit until paid. That portion is not the Venue\'s property, and the Venue shall not use it for any other purpose.',
    '',
    '3.4 No setoff. The Venue shall not reduce the Artist Share by any amount the Venue claims the Artist owes it under any other agreement, including damages, merchandise, hospitality or rider costs, unless the Artist agrees in writing after the Show.',
    '',
    '3.5 No circumvention. The Venue shall not sell admission to the Show outside iHYPE, bundle admission into other products, or reclassify ticket revenue (for example as a cover, drink minimum or VIP package) to reduce Net Ticket Receipts. Any such amounts are included in Gross Ticket Receipts, and the Venue shall report them on the Settlement Statement.',
    '',
    '3.6 Several obligations to each artist. Where several artists play the Show, the Venue owes each one its own Artist Share under its own Agreement. A shortfall, dispute or breach involving one artist does not reduce what is owed to another. The Venue represents that the Split Percentages it offers for a Show total no more than 100%.',
    '',
    guaranty,
    '',
    '4. CALCULATING THE ARTIST SHARE',
    '',
    '4.1 Formula. The Artist Share is calculated as:',
    '    Artist Share = max(Split % × (Gross − Tax − Refunds − Chargebacks − Approved Deductions), Guarantee)',
    '',
    '4.2 Worked example. 100 tickets at $18, 5.5% sales tax collected, 4 tickets refunded, no chargebacks, no Approved Deductions, Artist Split Percentage 70%, no Guarantee.',
    '    Gross Ticket Receipts (100 × $18 + tax)    1,899.00',
    '    Less sales tax                              −99.00',
    '    Less refunds (4 × $18)                      −72.00',
    '    Net Ticket Receipts                       1,728.00',
    '    Artist Share (70%)                        1,209.60',
    '    Venue keeps                                 518.40',
    '',
    '4.3 Rounding. Amounts are rounded to the nearest cent, and any rounding difference goes to the Artist.',
    '',
    '4.4 Card fees are the Venue\'s cost. Card-processing fees are charged to the Venue\'s Stripe account and are not deducted from Net Ticket Receipts, unless the Lineup Offer lists them as an Approved Deduction.',
    '',
    '4.5 Changes need both parties. The ticket price, Split Percentage, Guarantee and Approved Deductions can change only by a revised Lineup Offer accepted by the Artist in the iHYPE app before the Show. The Venue cannot change them on its own.',
    '',
    '5. PAYMENT',
    '',
    '5.1 When. The Venue shall pay the full Artist Share no later than the Settlement Date. If a Guarantee applies, at least the Guarantee is due by then even if the Venue disputes a Settlement Statement line.',
    '',
    '5.2 How. Payment goes to the payment method the Artist records in its iHYPE profile at acceptance, or later updates with at least 3 days\' notice. Examples include bank transfer, check, or an instant-payment app. The Venue bears any fee for sending.',
    '',
    `5.3 Proof of payment. When paying, the Venue shall mark the payment in the iHYPE app with the amount, date, method and a reference (such as a transfer ID or check number). The Artist confirms receipt or reports non-payment in the app. A payment is complete only when the Artist confirms it, or ${PAYMENT_AUTO_CONFIRM_DAYS} days pass after the Venue marks it paid without the Artist reporting a problem.`,
    '',
    '5.4 Late payment. Any unpaid Artist Share accrues interest from the Settlement Date at 1.5% per month or the maximum rate permitted by law, whichever is lower. The Venue also pays a late fee of $50 if not paid within 14 days after the Settlement Date.',
    '',
    '5.5 Partial payment. A partial payment does not settle the balance, even if marked "paid in full" or "final", unless the Artist agrees in writing. The Artist may accept a partial payment without waiving the rest.',
    '',
    '6. SETTLEMENT STATEMENT, RECORDS AND AUDIT',
    '',
    // retired-claim-exempt: counsel-approved contract text; "24 hours" is when the STATEMENT is generated, not a payout time.
    '6.1 Statement. Within 24 hours after the Show, iHYPE generates a Settlement Statement visible to the Venue and the Artist. It shows tickets sold, Gross Ticket Receipts through iHYPE, sales tax, refunds, chargebacks, any Approved Deductions, Net Ticket Receipts, the Artist Share and its due date.',
    '',
    `6.2 Off-platform sales. Within ${OFF_PLATFORM_REPORT_HOURS} hours after the Show, the Venue shall add to the Settlement Statement any admission sold outside iHYPE, including at the door. Unreported sales that later come to light are owed with interest under Section 5.4 from the Settlement Date.`,
    '',
    '6.3 Agreed record. Both parties agree the iHYPE figures in the Settlement Statement are accurate and binding for the sales they cover, unless a party shows a clear error within 30 days after the Show. The Venue waives any objection to iHYPE-recorded figures not raised in that time.',
    '',
    '6.4 Venue records. The Venue shall keep records of all Gross Ticket Receipts for the Show, including door sales, for at least 3 years.',
    '',
    '6.5 Audit right. On 10 days\' written notice, within 2 years after the Show, the Artist or its accountant may inspect the Venue\'s records for the Show during business hours. If an audit finds an underpayment of more than 5%, the Venue pays the shortfall, interest under Section 5.4, and the reasonable cost of the audit.',
    '',
    '7. REFUNDS, CHARGEBACKS, CANCELLATION AND POSTPONEMENT',
    '',
    '7.1 Refunds. Tickets are final sale, and buyers transfer tickets instead. The Venue may refund a ticket only if the Show is cancelled, if law requires it, or if the Artist agrees. Other refunds the Venue chooses to give are not Excluded Amounts and do not reduce the Artist Share.',
    '',
    '7.2 Chargebacks. A chargeback reduces Net Ticket Receipts only if the Venue submitted available evidence (such as the ticket scan record) and still lost. If a chargeback is decided after the Artist has been paid, the Venue may deduct the Artist\'s percentage of it from a later payment to the Artist under a separate Agreement, only with the Artist\'s written approval. Otherwise the Artist repays it within 30 days of a written request with the chargeback record.',
    '',
    '7.3 Cancelled by the Venue. If the Venue cancels the Show for any reason other than Section 7.4 or 7.5, the Venue refunds buyers at its own cost and pays the Artist the greater of the Guarantee, if any, and 50% of the Artist Share that Gross Ticket Receipts at the time of cancellation would have produced. The Venue bears every fee Stripe keeps on those refunds, including the card-processing fee Stripe does not return on a refunded charge, and none of it is charged to the Artist or deducted from any Artist Share.',
    '',
    '7.4 Cancelled by the Artist, or the Artist does not appear. If the Artist cancels, or does not appear and perform the Show, for any reason other than Section 7.5, (a) no Artist Share is owed, and (b) the Artist reimburses the Venue for the fees Stripe kept on the tickets refunded because of it, including the card-processing fee Stripe does not return on a refunded charge, within 30 days of the Venue\'s written request with the Stripe record of those fees. The Artist owes the Venue nothing else for the cancellation.',
    '',
    '7.5 Events outside either party\'s control. Neither party is liable for cancellation caused by events beyond its reasonable control, such as natural disaster, public-health orders, loss of power or venue damage it did not cause, or government action. Each party bears its own costs. Ticket sales and slow sales are not such events.',
    '',
    '7.6 Postponement. If the Show is moved to a new date both parties accept in the iHYPE app within 14 days, this Agreement applies to the new date and ticket sales carry over. If no new date is accepted, Section 7.3 or 7.5 applies as the cause requires.',
    '',
    '8. REMEDIES',
    '',
    '8.1 Breach. Failure to pay the full Artist Share by the Settlement Date is a material breach. The Artist does not have to give notice or an opportunity to cure before enforcing Section 5.4, but shall report non-payment in the iHYPE app.',
    '',
    '8.2 Debt owed. Any unpaid Artist Share is a liquidated debt the Venue owes the Artist, and the Settlement Statement is evidence of the amount.',
    '',
    '8.3 Collection costs and attorneys\' fees. In any action to enforce this Agreement, the prevailing party recovers its reasonable attorneys\' fees, court or filing costs and collection costs.',
    '',
    '8.4 Wrongful withholding. Knowingly withholding the Artist Share held in trust under Section 3.3 is a breach of trust in addition to a breach of contract, and the Artist may pursue every remedy available for that at law or in equity.',
    '',
    '8.5 Remedies are cumulative. Every remedy in this Agreement adds to any other right available by law. Delay or failure to enforce a right is not a waiver of it.',
    '',
    `8.6 iHYPE account measures. The Venue agrees that iHYPE may, under the iHYPE Venue Terms, pause new ticket sales, lineup offers or payouts setup for the Venue while an Artist's non-payment report remains unresolved beyond ${NON_PAYMENT_PAUSE_DAYS} days after the Settlement Date, and may show on the Venue's profile that it has an unresolved payment report. iHYPE decides whether to take these measures and is not liable to either party for taking them or not.`,
    '',
    '9. TAXES AND INDEPENDENT STATUS',
    '',
    '9.1 Sales tax. The Venue is the seller of admission to the Show. It alone sets, collects, reports and remits any sales, admissions or amusement tax on tickets.',
    '',
    '9.2 Payments to the Artist. The Venue is the payer of the Artist Share. It is responsible for any tax reporting on those payments, such as collecting a Form W-9 from the Artist and issuing any Form 1099 required by law. The Artist shall provide a completed W-9 on request before the Settlement Date; a late W-9 extends the Settlement Date by the days it was late but does not cancel the obligation.',
    '',
    '9.3 Withholding. The Venue may withhold from the Artist Share only amounts it is legally required to withhold, and shall give the Artist a record of each amount withheld.',
    '',
    '9.4 Artist\'s own taxes. The Artist is responsible for its own income taxes on the Artist Share.',
    '',
    '9.5 Independent parties. The Artist performs as an independent contractor. Nothing in this Agreement creates employment, partnership or joint venture between the Artist and the Venue, or between either of them and iHYPE.',
    '',
    '10. DISPUTES',
    '',
    '10.1 Talk first, briefly. A party with a dispute raises it in the iHYPE app. If it is not resolved within 10 days, either party may proceed under this Section. This step never delays payment of an undisputed amount or a Guarantee.',
    '',
    '10.2 Small claims. Either party may bring a claim in small claims court in the county where the Show took place, if the claim fits that court\'s limit.',
    '',
    '10.3 Other claims. Other claims are brought in the state or federal courts for the county where the Show took place, and both parties consent to that jurisdiction.',
    '',
    '10.4 Governing law. This Agreement is governed by the law of the state where the Show took place, without regard to conflict-of-laws rules.',
    '',
    '10.5 iHYPE is not a defendant. Neither party will name iHYPE in a claim about the Artist Share, except to compel iHYPE to produce records it holds under a lawful subpoena or court order. Under the iHYPE Terms, iHYPE keeps Settlement Statements and acceptance records for at least 3 years and makes them available to either party on request.',
    '',
    juryWaiver,
    '',
    '11. GENERAL TERMS',
    '',
    '11.1 Electronic acceptance. Both parties agree to form this Agreement electronically. Clicking "Send offer" (Venue) and "Accept and sign" (Artist) in the iHYPE app, after being shown the full text, is each party\'s signature under the federal E-SIGN Act and the Uniform Electronic Transactions Act as adopted in the governing state. Each party may download a PDF copy at any time.',
    '',
    '11.2 Entire agreement. This Agreement, including the accepted Lineup Offer, is the whole agreement about the Artist Share for the Show. It replaces any earlier discussion about the split. A separate performance agreement or rider may add terms, but if it conflicts with this Agreement about the Artist Share, this Agreement controls unless the other document says expressly that it overrides Section 4 and both parties signed it after this Agreement.',
    '',
    '11.3 Amendments. Changes must be accepted by both parties in the iHYPE app or in a writing both sign.',
    '',
    '11.4 Severability. If a court finds any provision unenforceable, it is limited to the minimum extent needed and the rest stays in force. A rate or fee found too high is reduced to the highest enforceable amount.',
    '',
    '11.5 Notices. Notices go through the iHYPE app and to the email on each party\'s iHYPE profile, and are received when sent. Each party shall keep its email current.',
    '',
    '11.6 Assignment and successors. The Venue may not assign this Agreement or its payment obligation without the Artist\'s written consent. It binds any buyer of the Venue\'s business or anyone who takes over the Show. The Artist may assign its right to payment on written notice.',
    '',
    '11.7 Survival. Sections 3 through 10 survive the Show, cancellation, and closure of either party\'s iHYPE account until the Artist Share is paid in full.',
    '',
    '11.8 Counterparts and copies. A PDF or printout of the accepted Agreement is as valid as the original.',
  ].join('\n');
}

/** SHA-256 of the rendered text, lowercase hex. What a signer signs. */
export async function hashAgreementText(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function renderAndHashAgreement(terms: SplitAgreementTerms) {
  const text = renderSplitAgreement(terms);
  return { version: SPLIT_AGREEMENT_VERSION, text, hash: await hashAgreementText(text) };
}

/** The signature block appended to the stored/PDF copy AFTER both have signed. Not part of the hash. */
export function signatureBlock(record: {
  venueSignerName: string; venueSignedAt: Date; artistSignerName: string; artistSignedAt: Date;
  hash: string; version: string; guarantorName: string | null;
}): string {
  const at = (d: Date) => d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  return [
    '',
    'SIGNATURES',
    `Venue: signed electronically by ${record.venueSignerName} on ${at(record.venueSignedAt)} by sending the Lineup Offer.`,
    ...(record.guarantorName ? [`Guarantor (Section 3.7): ${record.guarantorName}, accepted with the Venue's signature.`] : []),
    `Artist: signed electronically by ${record.artistSignerName} on ${at(record.artistSignedAt)} by accepting the Lineup Offer.`,
    `Agreement version ${record.version} · SHA-256 of the signed text: ${record.hash}`,
  ].join('\n');
}

/**
 * The Artist Share under Section 4, in cents, and the lines that make it.
 * Pure; the statement page and the tests both run it.
 */
export function computeArtistShare(input: {
  /** Face value plus tax collected through iHYPE on CAPTURED and later-refunded orders. */
  grossThroughIhypeCents: number;
  taxCents: number;
  refundsCents: number;
  chargebacksLostCents: number;
  /** Admission sold outside iHYPE (Section 6.2), tax excluded. */
  offPlatformCents: number;
  approvedDeductionsCents: number;
  splitPercent: number;
  guaranteeCents: number | null;
}) {
  const gross = input.grossThroughIhypeCents + input.offPlatformCents;
  const net = Math.max(0, gross - input.taxCents - input.refundsCents - input.chargebacksLostCents - input.approvedDeductionsCents);
  /* 4.3: rounded to the nearest cent, any rounding difference to the Artist —
     so a half cent rounds UP (Math.round does, for a positive amount; the
     epsilon keeps 0.5 from reading as 0.49999… after the multiply). */
  const bySplit = Math.round((net * input.splitPercent) / 100 + 1e-9);
  const share = Math.max(bySplit, input.guaranteeCents ?? 0);
  return { grossCents: gross, netCents: net, bySplitCents: bySplit, artistShareCents: share };
}

/**
 * Sections 7.3 and 7.4: the fees Stripe keeps on the refunds a cancellation
 * causes, estimated at Stripe's standard rate on each refunded charge. The
 * Stripe record governs; this is what the statement shows before it is read.
 */
export function refundFeesLostCents(refundedChargesCents: number[], feeOf: (chargeCents: number) => number): number {
  return refundedChargesCents.reduce((sum, charge) => sum + (charge > 0 ? feeOf(charge) : 0), 0);
}

/** Section 7.3: what a venue-cancelled Show owes the act. */
export function cancellationAmount(input: {
  grossAtCancellationCents: number; taxCents: number; splitPercent: number; guaranteeCents: number | null;
}) {
  const net = Math.max(0, input.grossAtCancellationCents - input.taxCents);
  const halfShare = Math.round((net * input.splitPercent) / 100 / 2 + 1e-9);
  return Math.max(halfShare, input.guaranteeCents ?? 0);
}
