import { kvGet, kvPut } from '@/lib/kv';
import { log } from '@/lib/logger';

/**
 * Single-use marking for WebAuthn challenges.
 *
 * ## What this closes
 *
 * Every passkey ceremony here issues its challenge into an httpOnly cookie and
 * reads it back on the POST that verifies the assertion. The cookie is the
 * ONLY record: nothing server-side ever knew the challenge had been spent, so
 * anyone holding a captured request — the assertion body together with its
 * `Cookie` header, out of a proxy log, a crash dump, a shared terminal — could
 * replay it verbatim for the five minutes the cookie lived and be handed a
 * session. Recorded as a follow-up by the 2026-09-02 sweep.
 *
 * A challenge is single-use by the WebAuthn spec. This is the server side of
 * that sentence.
 *
 * ## Why a "used" marker rather than a challenge record
 *
 * The obvious shape is to store the challenge at issue and require it to be
 * present at verify. **That shape can lock people out of their own accounts**,
 * and it is worth being explicit about why, because it looks stricter and is
 * therefore tempting. Cloudflare KV is eventually consistent: a write is not
 * guaranteed visible to the next read, particularly across colos. Under that
 * shape an unpropagated write is indistinguishable from a replay, so the
 * failure lands on the legitimate first attempt — on the only sign-in path
 * this product has, for an account whose only credential may be one device.
 *
 * So the record is written at VERIFY time and means "this challenge has been
 * presented once". Absence means "not seen before" and is allowed. That puts
 * every failure mode in the safe direction:
 *
 *   - KV lag or an outage → the marker is late or missing → the barrier is
 *     weakened to exactly what shipped before this file existed. Nobody is
 *     locked out.
 *   - A replay that arrives after the marker is visible → refused.
 *
 * ## What it does not claim
 *
 * `get` then `put` is not atomic, so two replays racing inside KV's
 * propagation window can both read absent. This is a barrier against a
 * captured request being replayed later — minutes, hours — which is the
 * actual threat. It is not a mutual-exclusion primitive, and a comment
 * claiming otherwise would be worse than the gap it papers over. An atomic
 * version needs the Durable Object the rate limiter uses; that is a larger
 * change and buys little against this threat.
 *
 * The challenge is hashed rather than stored, so an operator listing the
 * namespace never reads a live ceremony value, and the key length is fixed.
 */

export type PasskeyChallengeScope = 'signin' | 'admin-reauth' | 'admin-device' | 'register';

/** `fresh` — first presentation. `replay` — seen before, refuse. `unknown` — KV could not answer; allow, and the caller degrades to the pre-2026-09-06 behaviour. */
export type PasskeyChallengeVerdict = 'fresh' | 'replay' | 'unknown';

/**
 * Comfortably longer than the 300s the challenge cookies live, so a marker
 * never expires while the assertion it guards is still usable.
 */
const MARKER_TTL_SECONDS = 900;

async function markerKey(scope: PasskeyChallengeScope, challenge: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${scope}:${challenge}`));
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `pkchal:${scope}:${hex}`;
}

/**
 * Claim a challenge for its one permitted use.
 *
 * Call this BEFORE verifying the assertion, not after: a challenge is spent by
 * being presented, whatever the ceremony then returns. Marking only on success
 * would leave a failed attempt's challenge live for another try.
 */
export async function claimPasskeyChallenge(
  scope: PasskeyChallengeScope,
  challenge: string,
): Promise<PasskeyChallengeVerdict> {
  // Callers refuse an absent challenge before reaching here; treat one as
  // spent rather than silently allowing it, since refusing is the safe half.
  if (!challenge) return 'replay';

  try {
    const key = await markerKey(scope, challenge);
    if ((await kvGet<string>(key)) != null) return 'replay';
    await kvPut(key, '1', { ex: MARKER_TTL_SECONDS });
    return 'fresh';
  } catch (error) {
    log.error(
      '[passkey-challenge]',
      error instanceof Error ? error : { error: String(error) },
      `could not mark a ${scope} challenge used`,
    );
    return 'unknown';
  }
}
