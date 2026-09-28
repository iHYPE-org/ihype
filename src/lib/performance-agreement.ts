/**
 * THE ARTIST PERFORMANCE AGREEMENT (2026-09-28; owner, pasting the template:
 * "Add as a second in-app contract" and "Incorporate the split agreement
 * section into the artist performance agreement").
 *
 * One signed document per act per show. Part A is the performance terms from
 * the owner's template — the engagement, the technical and hospitality
 * requirements, promotion and recording, liability and insurance. Part B is
 * the Show Revenue Split Agreement (src/lib/split-agreement.ts) unchanged,
 * and it IS the compensation: the template's fixed fee, 50% deposit and
 * cancellation table are replaced by it, because the owner's rules (the venue
 * pays the act's share of ticket receipts within 7 days; an act that cancels
 * or does not appear is owed nothing and repays Stripe's fees) are Part B's.
 *
 * Where the template and Part B disagreed, Part A says so in its own words
 * rather than silently dropping a clause:
 *  - no deposit and no "pay before the Artist takes the stage" (Part B 5);
 *  - "may decline to perform and keep the deposit" is gone with the deposit;
 *  - the cancellation table and its illness excuse are Part B 7;
 *  - "stop performing if unsafe without losing the fee" keeps the Artist
 *    Share and any Guarantee;
 *  - "outdoor weather after the Artist arrived: the full fee is still due" is
 *    a cancellation by the Venue under Part B 7.3;
 *  - governing law and forum are Part B 10.
 *
 * Pure: no database. Rendered by `renderSplitAgreement`, which hashes the
 * whole document, so the same determinism rules apply — times are the venue's
 * wall-clock "HH:MM" as typed, never formatted through Intl.
 */
import { z } from 'zod';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time like 19:30.');
const shortText = (max: number) => z.string().trim().max(max);

export const PAID_BY = ['PURCHASER', 'ARTIST'] as const;
export type PaidBy = (typeof PAID_BY)[number];

const hospitalityItem = z.object({
  paidBy: z.enum(PAID_BY).default('ARTIST'),
  details: shortText(200).default(''),
});

/** Terms that hold for every act on the show. */
export const engagementSchema = z.object({
  purchaserLegalName: shortText(160).min(2, 'Enter the purchaser’s legal name.'),
  purchaserContact: shortText(200).min(3, 'Enter the purchaser’s contact phone and email.'),
  venueCapacity: z.number().int().positive().max(1_000_000).nullable().default(null),
  doorsTime: hhmm,
  ageRestriction: shortText(60).default('All ages'),
  setTimeFlexMinutes: z.number().int().min(0).max(240).default(30),
  stageSize: shortText(60).default(''),
  soundcheckMinutes: z.number().int().min(0).max(240).default(30),
  riderConfirmDays: z.number().int().min(0).max(120).default(14),
  dressingRoomHoursAfter: z.number().int().min(0).max(12).default(1),
  merchCommissionPercent: z.number().int().min(0).max(100).nullable().default(null),
  promoMaterialsDays: z.number().int().min(0).max(120).default(7),
  announceNotBefore: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  socialClipSeconds: z.number().int().min(0).max(600).default(60),
  insuranceCents: z.number().int().min(0).max(10_000_000_000).default(100_000_000),
});

/** Terms that differ from act to act. */
export const actPerformanceSchema = z.object({
  artistRepresentative: shortText(160).default(''),
  loadInTime: hhmm,
  soundcheckTime: hhmm,
  setStartTime: hhmm,
  setLengthMinutes: z.number().int().min(5).max(600),
  numberOfSets: z.number().int().min(1).max(10).default(1),
  billing: z.enum(['HEADLINER', 'CO_HEADLINER', 'SUPPORT']).default('SUPPORT'),
  billingTypePercent: z.number().int().min(1).max(100).nullable().default(null),
  backline: z.enum(PAID_BY).default('ARTIST'),
  travel: hospitalityItem.default({ paidBy: 'ARTIST', details: '' }),
  accommodation: hospitalityItem.default({ paidBy: 'ARTIST', details: '' }),
  meals: hospitalityItem.default({ paidBy: 'ARTIST', details: '' }),
  drinks: hospitalityItem.default({ paidBy: 'ARTIST', details: '' }),
  parking: hospitalityItem.default({ paidBy: 'ARTIST', details: '' }),
  guestListCount: z.number().int().min(0).max(200).default(0),
  technicalRider: shortText(4000).default(''),
  hospitalityRider: shortText(4000).default(''),
});

export type EngagementTerms = z.infer<typeof engagementSchema>;
export type ActPerformanceTerms = z.infer<typeof actPerformanceSchema>;
export type PerformanceTerms = EngagementTerms & ActPerformanceTerms;

export const performanceSchema = engagementSchema.extend(actPerformanceSchema.shape);

/** Reads a stored JSON value back into terms; null when absent or unreadable. */
export function parsePerformanceTerms(value: unknown): PerformanceTerms | null {
  const parsed = performanceSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function minutesOf(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** Refuses a schedule nobody could keep, before any text is shown. */
export function validatePerformanceTerms(p: PerformanceTerms): string | null {
  const load = minutesOf(p.loadInTime);
  const check = minutesOf(p.soundcheckTime);
  const set = minutesOf(p.setStartTime);
  // A late show can cross midnight, so only the order within one evening is checked.
  if (!(load <= check || check < 6 * 60)) return 'Soundcheck should be at or after load-in.';
  if (!(check <= set || set < 6 * 60)) return 'The set should start at or after soundcheck.';
  return null;
}

const PAID_LABEL: Record<PaidBy, string> = { PURCHASER: 'Purchaser', ARTIST: 'Artist' };
const BILLING_LABEL: Record<ActPerformanceTerms['billing'], string> = {
  HEADLINER: 'Headliner', CO_HEADLINER: 'Co-headliner', SUPPORT: 'Support',
};

function plainUsd(cents: number): string {
  const whole = Math.floor(cents / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `$${whole}.${String(cents % 100).padStart(2, '0')}`;
}

function orNone(value: string, none = 'None stated'): string {
  return value.trim() ? value.trim() : none;
}

/**
 * Part A and the two schedules, as lines. `ctx` carries what the Lineup Offer
 * header already states so Part A can name it without restating it.
 */
export function renderPerformanceParts(p: PerformanceTerms, ctx: {
  artistName: string;
  venueName: string;
  venueAddress: string | null;
  showTitle: string;
  showDate: string;
  zone: string;
}): { partA: string[]; schedules: string[] } {
  const hosp = (label: string, item: { paidBy: PaidBy; details: string }) =>
    `  - ${label}: paid by the ${PAID_LABEL[item.paidBy]}${item.details.trim() ? ` (${item.details.trim()})` : ''}`;

  const partA = [
    'PART A. PERFORMANCE TERMS',
    '',
    'This Part sets the terms under which the Artist will perform for the Venue, called the "Purchaser" in this Part, at the engagement below. The Artist\'s compensation, payment, settlement, cancellation and dispute terms are Part B (the Show Revenue Split Agreement), which forms part of this Agreement. Capitalised terms not defined in this Part have the meaning Part B gives them.',
    '',
    'A1. PARTIES AND ENGAGEMENT',
    '',
    `- Artist (stage name): ${ctx.artistName}. The Artist's legal name is the name it signs with below.`,
    `- Artist representative or agent: ${orNone(p.artistRepresentative)}`,
    `- Purchaser (legal name): ${p.purchaserLegalName}, operating ${ctx.venueName}`,
    `- Purchaser contact: ${p.purchaserContact}`,
    `- Event: ${ctx.showTitle}`,
    `- Venue: ${ctx.venueName}${ctx.venueAddress ? `, ${ctx.venueAddress}` : ''}`,
    `- Venue capacity: ${p.venueCapacity !== null ? p.venueCapacity : 'Not stated'}`,
    `- Performance date: ${ctx.showDate}`,
    `- Load-in: ${p.loadInTime} · Soundcheck: ${p.soundcheckTime} · Doors: ${p.doorsTime} · Set start: ${p.setStartTime} (all ${ctx.zone} time)`,
    `- Set length: ${p.setLengthMinutes} minutes · Number of sets: ${p.numberOfSets}`,
    `- Billing position: ${BILLING_LABEL[p.billing]}`,
    `- Age restriction: ${orNone(p.ageRestriction, 'All ages')}`,
    '',
    `A1.1 Set. The Artist will perform a set of its choosing within the agreed times. The Purchaser controls the event schedule and may move set times by no more than ${p.setTimeFlexMinutes} minutes, with notice to the Artist.`,
    '',
    'A2. COMPENSATION',
    '',
    'A2.1 Part B governs. The Artist is paid the Artist Share under Part B, including any Guarantee stated in the Lineup Offer, by the Settlement Date. No deposit is payable and nothing is paid before the Artist takes the stage. Part B also governs settlement (Section 6), taxes (Section 9) and what is owed if the Show is cancelled (Section 7).',
    '',
    `A2.2 Merchandise. The Artist may sell its merchandise at the venue. ${p.merchCommissionPercent === null || p.merchCommissionPercent === 0 ? 'The venue takes no commission on merchandise.' : `The venue's merchandise commission is ${p.merchCommissionPercent}% of gross merchandise sales.`} The Purchaser will provide a table and a lit, secure sales area. Merchandise money is not Gross Ticket Receipts.`,
    '',
    'A3. PERFORMANCE AND TECHNICAL REQUIREMENTS',
    '',
    'The Artist will arrive on time and deliver a professional performance. The Purchaser will provide a safe, working stage and the following at no cost to the Artist:',
    `- Technical rider: Schedule A forms part of this Agreement. The Purchaser will confirm any item it cannot supply at least ${p.riderConfirmDays} days before the Show.`,
    '- Sound and lighting: a professional PA, monitors and stage lighting suited to the venue, with a qualified engineer on site from load-in to the end of the set.',
    `- Stage: ${p.stageSize.trim() ? `at least ${p.stageSize.trim()}` : 'suited to the venue'}, with grounded power within reach and a clear path for load-in.`,
    `- Soundcheck: at least ${p.soundcheckMinutes} minutes, at the time in A1.`,
    `- Backline: ${p.backline === 'ARTIST' ? 'the Artist supplies its own.' : 'the Purchaser supplies it as listed in Schedule A.'}`,
    `- Dressing room: a private, lockable room with mirror, seating, toilet access and power, available from load-in until ${p.dressingRoomHoursAfter} hour${p.dressingRoomHoursAfter === 1 ? '' : 's'} after the set.`,
    '- Security: enough security staff to keep the stage, dressing room and the Artist\'s equipment safe throughout the event.',
    '- Conduct: neither party will act in a way that puts people or property at risk. The Artist may stop performing if conditions become unsafe, without losing any Artist Share or Guarantee under Part B.',
    '',
    'A4. HOSPITALITY, TRAVEL AND ACCOMMODATION',
    '',
    'The Purchaser covers the items marked "paid by the Purchaser" below. Anything else is the Artist\'s cost.',
    hosp('Travel to and from the venue', p.travel),
    hosp('Accommodation', p.accommodation),
    hosp('Meals or buyout', p.meals),
    hosp('Drinks rider (Schedule B)', p.drinks),
    hosp('Parking', p.parking),
    `  - Guest list: ${p.guestListCount} complimentary ticket${p.guestListCount === 1 ? '' : 's'}, provided by the Purchaser. Complimentary tickets are not sold and are not Gross Ticket Receipts.`,
    'The Purchaser will provide bottled water on stage and in the dressing room.',
    '',
    'A5. PROMOTION, BILLING AND RECORDING RIGHTS',
    '',
    'The Purchaser will promote the Show, and the Artist grants a limited licence to use its name and approved images for that purpose only.',
    `A5.1 Promotional materials. The Artist will supply a bio, press photos and logo within ${p.promoMaterialsDays} days of signing. The Purchaser will use only these or other Artist-approved materials.`,
    `A5.2 Billing. The Artist will be billed as ${BILLING_LABEL[p.billing].toLowerCase()} in all advertising${p.billingTypePercent !== null ? `, at no less than ${p.billingTypePercent}% of the headliner's type size` : ''}.`,
    `A5.3 Announcement. ${p.announceNotBefore ? `Neither party will announce the Show before ${p.announceNotBefore} without the other's written consent.` : 'Either party may announce the Show once this Agreement is signed.'}`,
    `A5.4 Recording and streaming. No audio or video recording, broadcast or livestream of the performance is allowed without the Artist's prior written consent, except short clips for the Purchaser's social media of no more than ${p.socialClipSeconds} seconds.`,
    'A5.5 Ownership. The Artist keeps all rights in its name, likeness, music and performance. Any approved recording may be used only as agreed in writing.',
    'A5.6 Sponsorship. The Artist will not be associated with any sponsor without its prior written approval.',
    '',
    'A6. FORCE MAJEURE, LIABILITY AND INSURANCE',
    '',
    'A6.1 Cancellation. What is owed when the Show is cancelled, by whom, is Part B Section 7: the Venue bears the fees Stripe keeps on refunds when it cancels, and an Artist that cancels or does not appear is owed nothing and repays those fees. Events outside either party\'s control are Part B Section 7.5, and the affected party must tell the other as soon as possible.',
    '',
    'A6.2 Weather (outdoor events). If the Purchaser cancels or stops an outdoor event for weather after the Artist has arrived, it is a cancellation by the Venue under Part B Section 7.3, not an event under Section 7.5.',
    '',
    'A6.3 Liability. Each party is responsible for injury or damage caused by its own negligence or that of its staff and guests. The Purchaser is responsible for the audience and the venue. The Artist is responsible for its members and crew.',
    '',
    'A6.4 Indemnity. Each party will indemnify the other against claims arising from its own breach of this Agreement or its negligence.',
    '',
    `A6.5 Insurance. The Purchaser will carry general liability insurance of at least ${plainUsd(p.insuranceCents)} per occurrence for the Show. The Artist is responsible for insuring its own equipment.`,
    '',
    'A7. GENERAL',
    '',
    'A7.1 One agreement. Part A, Part B and Schedules A and B are the whole agreement between the parties for the Show and replace any earlier discussion. If Part A and Part B conflict about money, payment or cancellation, Part B controls.',
    '',
    'A7.2 Changes. Any change must be accepted by both parties in the iHYPE app, as a revised Lineup Offer, or in a writing both sign (Part B 11.3).',
    '',
    'A7.3 Assignment, independent status, governing law, severability and signatures are as Part B Sections 9.5, 10 and 11 state.',
  ];

  const schedules = [
    'SCHEDULE A. TECHNICAL RIDER',
    '',
    orNone(p.technicalRider, 'None attached. The Purchaser provides the items in A3.'),
    '',
    'SCHEDULE B. HOSPITALITY RIDER',
    '',
    orNone(p.hospitalityRider, 'None attached. Hospitality is as A4 states.'),
  ];

  return { partA, schedules };
}
