import { cookies } from 'next/headers';
import { db } from '@/lib/db';

/**
 * Who gets credited from the 10% promoter pool for a ticket, and how that
 * survives the trip from a HYPE link to a purchase.
 *
 * ## The gap this closes
 *
 * A HYPE link is `ihype.org/h/<hexId>` — a person's link, not a show's. It
 * recorded the click and sent everyone to `/register?ref=<hexId>`. Attribution
 * on a ticket, though, is read from the SHOW page's `?ref=` at the moment of
 * purchase. So the journey the product actually asks for — follow a friend's
 * link, make an account, buy a ticket — arrived at the show page with no `ref`
 * at all, and the promoter got nothing. The pool exists to pay people for
 * exactly that journey.
 *
 * The code now rides in a cookie, so it survives signup, the redirect after
 * signup, and any amount of browsing before the buy. Query parameters still
 * win when present: a link shared with `?ref=` on a specific show is a more
 * precise statement of intent than a cookie set days ago.
 *
 * ## Why a cookie rather than the session
 *
 * The person following the link usually has no account yet, so there is no
 * session to hang it on — that is the whole point of the flow. It is set
 * before they sign up and read after.
 */

/** 30 days. Long enough to survive "I'll buy it on payday", short enough not to be forever. */
export const REFERRAL_COOKIE = 'ihype_ref';
export const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export type AffiliatePromoter = { id: string; name: string } | null;

/**
 * Resolves the promoter to credit, in order of how deliberate the signal is:
 *
 * 1. `?affiliate=<profileId>` — an explicit internal link.
 * 2. `?ref=<hexId>` — a HYPE link followed to this exact page.
 * 3. the `ihype_ref` cookie — a HYPE link followed at some point before this.
 *
 * Returns null when nothing resolves, which is the normal case and not an
 * error: most tickets are bought without a promoter, and the pool simply has
 * no claimant for them.
 */
export async function resolveAffiliatePromoter({
  affiliateId,
  refHexId,
}: {
  affiliateId?: string;
  refHexId?: string;
}): Promise<AffiliatePromoter> {
  const cookieRef = await readReferralCookie();

  if (affiliateId) {
    const byId = await db.profile
      .findFirst({ where: { id: affiliateId }, select: { id: true, name: true } })
      .catch(() => null);
    if (byId) return byId;
  }

  for (const hexId of [refHexId, cookieRef]) {
    if (!hexId) continue;
    const byHex = await db.profile
      .findFirst({ where: { hexId }, select: { id: true, name: true } })
      .catch(() => null);
    if (byHex) return byHex;
  }

  return null;
}

export async function readReferralCookie(): Promise<string | undefined> {
  try {
    const store = await cookies();
    const value = store.get(REFERRAL_COOKIE)?.value?.trim();
    return value ? value.slice(0, 80) : undefined;
  } catch {
    // Read outside a request scope — there is simply no cookie to find.
    return undefined;
  }
}
