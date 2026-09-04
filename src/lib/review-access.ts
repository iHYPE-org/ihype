/**
 * Store-review sign-in, without giving anybody a password.
 *
 * ## The problem
 *
 * An App Store or Play reviewer installs the binary, cannot sign in, and
 * rejects it — Apple under guideline 2.1, the most common rejection for an app
 * with an account. Neither of iHYPE's two sign-ins reaches them:
 *
 *   · A passkey is bound to a device they do not have, and Android's WebView
 *     has no conditional mediation at all.
 *   · A magic link is delivered by email, and a reviewer has no mailbox at
 *     `ihype.org`.
 *
 * The obvious fix is a username and a password, and it was built and thrown
 * away on 2026-09-04 by owner instruction: *"I don't want users to have a
 * password. I want magic key via email or passkey only. It's WAY safer."*
 * That instruction is right and this module is what replaces it.
 *
 * ## What this is
 *
 * The SAME magic link, minted by an administrator instead of emailed, and
 * pasted into the App Review notes. No new authentication mechanism, no form
 * on `/login`, nothing a member can see or reach. Measured against the
 * password it replaces it is narrower on every axis:
 *
 *   · 256 bits of `crypto.getRandomValues`, not a human-chosen string.
 *   · Stored as a SHA-256 hash, like every other magic link — a database
 *     reader cannot sign in as anybody.
 *   · A fixed, small number of redemptions, then dead.
 *   · An explicit expiry, and revocable before it by deleting the row.
 *   · No login form to attack, so no rate limit to get right and no oracle to
 *     leak. There is nothing to guess at.
 *
 * ## Why it is not single-use
 *
 * A member's link is redeemed once, seconds after it is sent. A review is not
 * one moment: the session JWT lasts 12 hours, review can span days, an app can
 * be re-tested after a rejection, and two people may look at it. A single-use
 * link strands a reviewer mid-review with no way to ask us for another, which
 * is the failure this whole module exists to prevent.
 *
 * So it is FEW-use rather than one-use or unlimited. `DEFAULT_USES` is enough
 * for a re-test and a colleague; unlimited would make the URL a password again,
 * just one nobody chose.
 */

import { hashMagicLinkToken } from '@/lib/magic-link-token';

/** Redemptions a freshly minted review link carries. */
export const DEFAULT_USES = 12;

/** How long it lives. Longer than any review, shorter than forever. */
export const DEFAULT_TTL_DAYS = 60;

/** Refuse to mint something that is a password in all but name. */
export const MAX_USES = 50;
export const MAX_TTL_DAYS = 180;

export type MintOptions = { uses?: number; ttlDays?: number };

export type MintPlan = {
  /** The secret itself. Returned to the caller ONCE and never stored. */
  token: string;
  /** What actually goes in the database. */
  tokenHash: string;
  expiresAt: Date;
  remainingUses: number;
};

/**
 * Rejects a request that is out of range instead of clamping it.
 *
 * Clamping is the friendlier behaviour and the wrong one here: an operator who
 * asks for a 5-year link and is silently handed a 180-day one believes they
 * have the first, and finds out when a reviewer cannot get in. The whole point
 * of these bounds is that somebody knows what the link's limits are.
 */
export function validateMintOptions(options: MintOptions): { ok: true } | { ok: false; reason: string } {
  const uses = options.uses ?? DEFAULT_USES;
  const ttlDays = options.ttlDays ?? DEFAULT_TTL_DAYS;

  if (!Number.isInteger(uses) || uses < 1) return { ok: false, reason: 'uses must be a whole number of at least 1' };
  if (uses > MAX_USES) return { ok: false, reason: `uses must be ${MAX_USES} or fewer — a link with more is a password` };
  if (!Number.isInteger(ttlDays) || ttlDays < 1) return { ok: false, reason: 'ttlDays must be a whole number of at least 1' };
  if (ttlDays > MAX_TTL_DAYS) return { ok: false, reason: `ttlDays must be ${MAX_TTL_DAYS} or fewer` };

  return { ok: true };
}

/**
 * Builds the row and the secret. Pure but for the CSPRNG and the clock, so the
 * shape is testable without a database — the same split the rest of this
 * codebase uses to keep `@/lib/db` out of unit tests.
 */
export function planReviewLink(options: MintOptions = {}, now = new Date()): MintPlan {
  /* 32 bytes, hex. The same length the emailed magic link uses, because there
     is no reason for the long-lived one to be weaker and every reason for it
     to be stronger. */
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

  const ttlDays = options.ttlDays ?? DEFAULT_TTL_DAYS;
  return {
    token,
    tokenHash: hashMagicLinkToken(token),
    expiresAt: new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000),
    remainingUses: options.uses ?? DEFAULT_USES,
  };
}

/**
 * Where a minted link points.
 *
 * The same resolution order `sendMagicLinkEmail` uses, lifted here so the two
 * cannot disagree — a review link that resolves somewhere the emailed one does
 * not is a reviewer staring at a dead URL, and nothing in this repository would
 * report it. Reads `process.env` rather than `readRuntimeEnv` for exactly that
 * reason: these three are build-time `[vars]`, not Worker secrets, and the
 * emailed path reads them this way.
 */
export function reviewLinkBaseUrl(): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    'https://ihype.org';
  return baseUrl.replace(/\/$/, '');
}

/**
 * What a redemption should do to the row, given its current state.
 *
 * Extracted and pure because the consume path is where a multi-use token can
 * go wrong quietly: a link that decrements but never sets `used` stays
 * redeemable at zero, and one that sets `used` on the first redemption is
 * single-use wearing a counter. Both are invisible until a reviewer is locked
 * out, so both are asserted in `review-access.test.ts` rather than reasoned
 * about here.
 *
 * `remainingUses === null` is the member link this model was built for and
 * MUST keep behaving exactly as it did: one use, `used` set.
 */
export function planRedemption(remainingUses: number | null): { allowed: boolean; nextRemaining: number | null; markUsed: boolean } {
  if (remainingUses === null) return { allowed: true, nextRemaining: null, markUsed: true };
  if (remainingUses <= 0) return { allowed: false, nextRemaining: 0, markUsed: true };

  const next = remainingUses - 1;
  return { allowed: true, nextRemaining: next, markUsed: next === 0 };
}
