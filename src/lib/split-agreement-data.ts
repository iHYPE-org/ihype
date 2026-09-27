/**
 * The database half of the Show Revenue Split Agreement (DESIGN_SYNC row 528).
 * `split-agreement.ts` holds the words and the arithmetic; this holds who has
 * signed, whether a show may sell, and the payment method an act is paid by.
 */
import type { Prisma } from '@prisma/client/edge';
import { db } from '@/lib/db';
import type { ApprovedDeduction, SplitAgreementTerms } from '@/lib/split-agreement';

export const PAYOUT_METHOD_KINDS = ['BANK_TRANSFER', 'CHECK', 'PAYMENT_APP', 'OTHER'] as const;
export type PayoutMethodKind = (typeof PAYOUT_METHOD_KINDS)[number];

export function isPayoutMethodKind(value: unknown): value is PayoutMethodKind {
  return typeof value === 'string' && (PAYOUT_METHOD_KINDS as readonly string[]).includes(value);
}

/** English, because it is written into a signed agreement (5.2). */
export function describePayoutMethod(kind: string | null | undefined, details: string | null | undefined): string | null {
  if (!kind || !details?.trim()) return null;
  const label = kind === 'BANK_TRANSFER' ? 'Bank transfer'
    : kind === 'CHECK' ? 'Check'
      : kind === 'PAYMENT_APP' ? 'Payment app'
        : 'Other';
  return `${label}: ${details.trim()}`;
}

export function parseApprovedDeductions(value: Prisma.JsonValue | null | undefined): ApprovedDeduction[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const label = (entry as Record<string, unknown>).label;
    const capCents = (entry as Record<string, unknown>).capCents;
    return typeof label === 'string' && typeof capCents === 'number' ? [{ label, capCents }] : [];
  });
}

export function venueAddressLine(venue: { addressLine1?: string | null; city?: string | null; stateRegion?: string | null; postalCode?: string | null }): string | null {
  const parts = [venue.addressLine1, venue.city, [venue.stateRegion, venue.postalCode].filter(Boolean).join(' ')].map((p) => p?.trim()).filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export function termsFor(input: {
  show: { id: string; title: string; startsAt: Date; timeZone: string | null };
  venue: { name: string; addressLine1?: string | null; city?: string | null; stateRegion?: string | null; postalCode?: string | null };
  artistName: string;
  slot: {
    splitPercent: number;
    guaranteeCents: number | null;
    approvedDeductions: Prisma.JsonValue | null;
    guarantorName: string | null;
    juryWaiver: boolean;
  };
}): SplitAgreementTerms {
  return {
    showId: input.show.id,
    showTitle: input.show.title,
    showStartsAt: input.show.startsAt.toISOString(),
    showTimeZone: input.show.timeZone,
    venueName: input.venue.name,
    venueAddress: venueAddressLine(input.venue),
    artistName: input.artistName,
    splitPercent: input.slot.splitPercent,
    guaranteeCents: input.slot.guaranteeCents,
    approvedDeductions: parseApprovedDeductions(input.slot.approvedDeductions),
    guarantorName: input.slot.guarantorName,
    juryWaiver: input.slot.juryWaiver,
  };
}

export type AgreementReadiness =
  | { ready: true }
  | { ready: false; code: 'NO_OFFER' | 'AWAITING_SIGNATURES'; pendingActs: string[] };

/**
 * Whether every act on a show has a signed, current agreement. A ticket may be
 * sold only when this is ready (owner, 2026-09-27: every ticketed show).
 */
export function judgeAgreementReadiness(
  slots: { status: string; profileName: string; hasAgreement: boolean }[],
): AgreementReadiness {
  if (slots.length === 0) return { ready: false, code: 'NO_OFFER', pendingActs: [] };
  const pending = slots.filter((s) => s.status !== 'ACCEPTED' || !s.hasAgreement).map((s) => s.profileName);
  return pending.length ? { ready: false, code: 'AWAITING_SIGNATURES', pendingActs: pending } : { ready: true };
}

export async function readAgreementReadiness(showId: string): Promise<AgreementReadiness> {
  const slots = await db.showLineupSlot.findMany({
    where: { showId },
    select: { status: true, profile: { select: { name: true } }, agreement: { select: { id: true, supersededAt: true } } },
  });
  return judgeAgreementReadiness(slots.map((s) => ({
    status: s.status,
    profileName: s.profile.name,
    hasAgreement: Boolean(s.agreement && !s.agreement.supersededAt),
  })));
}
