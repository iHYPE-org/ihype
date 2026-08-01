/**
 * The anti-bot decisions in front of a ticket purchase, as pure functions.
 *
 * Ticket bots are an economic problem, not a traffic problem: resale
 * (`/api/tickets/[serializedId]/list-resale`) is what makes hoarding pay, so
 * the purchase endpoint is the chokepoint worth defending. These rules fail in
 * two directions and both are expensive — too loose and a scripted client
 * drains an allocation before fans wake up; too tight and a group of six
 * friends cannot buy together and we have simply broken ticketing.
 *
 * Kept separate from the route so the arithmetic can be tested without Stripe,
 * a database, or a Workers runtime — the precedent set by
 * `src/lib/player-recovery.ts` and `src/lib/focus-trap.ts`.
 */

/**
 * Total tickets one account may hold for one show, across every order.
 *
 * Deliberately equal to the per-ORDER maximum in the route's zod schema. That
 * cap was the only quantity limit in the system, which made it look like a
 * per-person limit while actually permitting `rate limit × 8` per person per
 * hour — 80 tickets for a single show from one account.
 */
export const MAX_TICKETS_PER_SHOW_PER_ACCOUNT = 8;

export type PurchaseAllowance = {
  allowed: boolean;
  /** How many more this account may buy for this show. */
  remaining: number;
  /** Present when refused — safe to show the buyer verbatim. */
  reason?: string;
};

/**
 * Decides whether an account may add `requested` more tickets for one show.
 *
 * `alreadyHeld` must count every non-void order for the show, including ones
 * still RESERVED: a bot that opens many reservations and never captures would
 * otherwise hold an allocation for free while counting as zero.
 */
export function resolvePurchaseAllowance(
  alreadyHeld: number,
  requested: number,
  max: number = MAX_TICKETS_PER_SHOW_PER_ACCOUNT,
): PurchaseAllowance {
  const held = Number.isFinite(alreadyHeld) && alreadyHeld > 0 ? Math.floor(alreadyHeld) : 0;
  const remaining = Math.max(0, max - held);

  if (requested <= 0) {
    return { allowed: false, remaining, reason: 'Choose at least one ticket.' };
  }
  if (remaining === 0) {
    return {
      allowed: false,
      remaining: 0,
      // Names the limit and the number held, so a real buyer who hit it can
      // tell this from a generic failure and knows what to do next.
      reason: `You already have ${held} ${held === 1 ? 'ticket' : 'tickets'} for this show, which is the maximum of ${max} per person.`,
    };
  }
  if (requested > remaining) {
    return {
      allowed: false,
      remaining,
      reason: `You can buy ${remaining} more ${remaining === 1 ? 'ticket' : 'tickets'} for this show — the limit is ${max} per person.`,
    };
  }
  return { allowed: true, remaining: remaining - requested };
}

export type BotSignal = {
  /** Minutes since the account was created, or null when unknown. */
  accountAgeMinutes: number | null;
  /** Whether the buyer passed the interactive challenge. */
  humanVerified: boolean;
};

/**
 * Whether a purchase attempt should be recorded as suspicious.
 *
 * Deliberately NOT a blocking decision — it drives an operator alert only.
 * Blocking on account age would punish the fan who signs up because their
 * favourite band just announced a date, which is the single most common
 * legitimate reason to make an iHYPE account at all.
 */
export function isSuspiciousPurchase({ accountAgeMinutes, humanVerified }: BotSignal): boolean {
  if (!humanVerified) return true;
  return accountAgeMinutes !== null && accountAgeMinutes < 5;
}
