/**
 * The code a ticket holder hands to whoever they are giving the ticket to.
 *
 * WHY A CODE AND NOT AN EMAIL ADDRESS. Transfer already existed, and it needed
 * the recipient's email — which is the wrong shape twice over. It asks the
 * sender for something they may not know, and it does not actually move the
 * ticket: `/api/tickets/[id]/transfer` rewrites `holderEmail` but leaves
 * `buyerUserId` alone, and every ticket list in the app is scoped
 * `where: { buyerUserId }` (see `loadFan` in mmm-me.ts). So an emailed transfer
 * left the ticket in the SENDER's list forever and never put it in the
 * recipient's; they got a mail with serialized ids and no ticket in their
 * account. A code redeemed by a signed-in account is what makes the handoff
 * real (owner, 2026-08-25: "transfer options (to another user via code)").
 *
 * WHY CROCKFORD BASE32. This is read aloud, texted, and typed by someone who
 * did not choose it. Crockford's alphabet drops I, L, O and U — the first three
 * because they are indistinguishable from 1 and 0 in most faces, U because
 * excluding it keeps accidental obscenities out of generated codes — and it
 * defines a canonical decoding, so `normalizeTransferCode` can accept what a
 * person actually typed (lowercase, spaces, hyphens, an l for a 1) rather than
 * rejecting them for it. A code a member has to retype three times is a code
 * they photograph and send as an image instead.
 */

/** Crockford base32: 10 digits + 22 letters, no I, L, O or U. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** 8 symbols over 32 = 2^40, about 1.1 x 10^12 codes. Long enough that
 *  guessing is hopeless even before the claim endpoint's rate limit, short
 *  enough to read down a phone line in two breaths. */
export const TRANSFER_CODE_LENGTH = 8;

/** Three days. Long enough to hand a ticket over at a gig or the next day,
 *  short enough that a code screenshotted and forgotten stops working. A
 *  transfer nobody completes must expire, or every code ever minted stays a
 *  live claim on somebody's ticket. */
export const TRANSFER_CODE_TTL_MS = 72 * 60 * 60 * 1000;

/**
 * A fresh code. Uses the platform CSPRNG — `Math.random` is predictable and
 * this value is a bearer credential for something a member paid for.
 *
 * Rejection sampling rather than `% 32`: 256 is a whole multiple of 32 so a
 * plain modulo happens to be unbiased here, but that is a property of today's
 * alphabet length. Sampling explicitly means changing ALPHABET cannot quietly
 * introduce a bias toward its first letters.
 */
export function createTransferCode(randomBytes: (n: number) => Uint8Array = defaultRandomBytes): string {
  const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  let out = '';
  while (out.length < TRANSFER_CODE_LENGTH) {
    const chunk = randomBytes(TRANSFER_CODE_LENGTH);
    for (const byte of chunk) {
      if (byte >= limit) continue;
      out += ALPHABET[byte % ALPHABET.length];
      if (out.length === TRANSFER_CODE_LENGTH) break;
    }
  }
  return out;
}

function defaultRandomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * What a person typed, turned into what is stored, or null if it cannot be one.
 *
 * Accepts lowercase, spaces, hyphens and the three confusable letters. Returns
 * null rather than a best guess for anything else: a claim endpoint must not
 * treat a mistyped code as a different valid code, and silently dropping an
 * unexpected character could do exactly that.
 */
export function normalizeTransferCode(input: string): string | null {
  const cleaned = input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    // Crockford's canonical confusables. Done before the alphabet check, which
    // is why an `l` in place of a `1` is accepted rather than refused.
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');
  if (cleaned.length !== TRANSFER_CODE_LENGTH) return null;
  for (const character of cleaned) {
    if (!ALPHABET.includes(character)) return null;
  }
  return cleaned;
}

/** Grouped for reading and reading aloud. Display only — never store this. */
export function formatTransferCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** True when a minted code can still be redeemed. Kept here, beside the TTL it
 *  depends on, so the route and any UI countdown cannot disagree about it. */
export function isTransferCodeLive(
  row: { expiresAt: Date; claimedAt: Date | null },
  now: Date = new Date(),
): boolean {
  return row.claimedAt === null && row.expiresAt.getTime() > now.getTime();
}
