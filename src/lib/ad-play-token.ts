import { createHmac } from 'crypto';
import { readRuntimeEnv } from '@/lib/runtime-env';
import { constantTimeEqual } from '@/lib/secret-compare';

/**
 * A play token is the server's own receipt that it served THIS spot to THIS
 * listener, and it is what makes an ad impression provable.
 *
 * Until this existed, `POST /api/ads/impression` took a bare `adId` — a value
 * that is public in every station payload and every show production plan — and
 * spent nine cents of a real advertiser's authorized budget for it. The
 * defences were a rate limit and a once-per-listener-per-day dedup, so the
 * cheapest attack was not a loop from one address but a spread: an `adId` is
 * readable by anyone, and every distinct caller who posted it was billed as a
 * genuine play. Nothing anywhere asked whether the ad had actually been served
 * to that caller. Now the impression carries a token the client cannot mint,
 * and the route reads the `adId` OUT of the token rather than off the body.
 *
 * THE DIRECTION THIS FAILS IN IS THE OPPOSITE OF THE AUTH CONTROLS, ON
 * PURPOSE. `passkey-challenge.ts` and `session-revocation.ts` fail towards
 * letting a member in, because a control on the only way into an account must
 * never lock out a real person. This one fails towards NOT CHARGING: an
 * unreadable secret, a mangled token or a clock skew costs an advertiser some
 * delivery, which is recoverable, where the other direction bills somebody for
 * airtime nobody heard, which is not. Do not "fix" a verification failure by
 * falling through to a charge.
 *
 * What the token deliberately does NOT do:
 *
 *   - It is not single-use. Marking a nonce spent needs a KV write on the
 *     serving path and a KV read on the billing path, and it buys nothing the
 *     existing dedup does not already buy: a member is charged once per ad per
 *     day on the impression rows, an anonymous listener once per address per
 *     ad per day. Replaying a token you legitimately hold is already free.
 *   - It does not prove the audio reached a speaker. That needs a signed
 *     progress report from the player and a server-side duration check, and
 *     the honest limit is recorded in docs/security-sweep-2026-09-02.md.
 *
 * The secret is `AUTH_SECRET`, domain-separated by the message prefix below so
 * a play token can never be replayed as a session, an unsubscribe link or any
 * other thing this secret signs. Read softly through `readRuntimeEnv` rather
 * than through `env`, which throws: an ad path must degrade, not 500.
 */

const VERSION = 'v1';
const DOMAIN = 'ad-play-token/v1';

/** Twelve hours. A station queue is served once and can sit for hours before
 *  the last break in it plays, so a short window would refuse honest late
 *  impressions; a long one only widens the replay window a caller already has
 *  for free through the daily dedup. */
export const AD_PLAY_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

export type AdPlayTokenFailure =
  | 'unconfigured'
  | 'missing'
  | 'malformed'
  | 'bad_signature'
  | 'expired'
  | 'wrong_listener';

export type AdPlayTokenResult =
  | { ok: true; adId: string; subject: string }
  | { ok: false; reason: AdPlayTokenFailure };

type Payload = { a: string; s: string; x: number };

function secret(): string | null {
  const value = readRuntimeEnv('AUTH_SECRET');
  return typeof value === 'string' && value.length >= 16 ? value : null;
}

function b64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function sign(payload: string, key: string): string {
  return createHmac('sha256', key).update(`${DOMAIN}|${payload}`).digest('base64url');
}

/**
 * Mints a receipt for one spot served to one listener.
 *
 * `subject` is the signed-in listener's id, or an empty string for a signed-out
 * view (the public show page airs ads to visitors). A token minted for a member
 * is only redeemable by that member, so handing it to a hundred friends buys a
 * hundred refusals rather than a hundred charges; an anonymous token is bearer,
 * because there is nothing to bind it to and the per-address dedup already caps
 * what it can cost.
 *
 * Returns null when the secret is unreadable — the caller then serves the clip
 * with no token and the impression is refused, which is the safe direction.
 */
export function createAdPlayToken(adId: string, subject: string | null | undefined, now = Date.now()): string | null {
  const key = secret();
  if (!key) return null;
  if (typeof adId !== 'string' || adId.length === 0 || adId.length > 64) return null;
  const payload: Payload = {
    a: adId,
    s: typeof subject === 'string' ? subject.slice(0, 64) : '',
    x: Math.floor((now + AD_PLAY_TOKEN_TTL_MS) / 1000),
  };
  const encoded = b64url(JSON.stringify(payload));
  return `${VERSION}.${encoded}.${sign(encoded, key)}`;
}

/**
 * The `adId` a valid token names, or the reason it is not billable.
 *
 * The token is the AUTHORITY on which campaign is being charged — never the
 * request body. A caller who can name any `adId` and have it billed is the
 * whole defect this closes, so a route must spend what this returns and
 * nothing else.
 */
export function verifyAdPlayToken(
  token: string | null | undefined,
  subject: string | null | undefined,
  now = Date.now(),
): AdPlayTokenResult {
  if (typeof token !== 'string' || token.length === 0) return { ok: false, reason: 'missing' };
  const key = secret();
  if (!key) return { ok: false, reason: 'unconfigured' };

  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== VERSION) return { ok: false, reason: 'malformed' };
  const [, encoded, signature] = parts;
  if (!encoded || !signature) return { ok: false, reason: 'malformed' };

  /* Signature first, then read. Parsing attacker-controlled JSON before
     authenticating it is how a verifier ends up with its behaviour steered by
     the thing it is meant to be checking. */
  if (!constantTimeEqual(signature, sign(encoded, key))) return { ok: false, reason: 'bad_signature' };

  let payload: Payload;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (typeof parsed !== 'object' || parsed === null) return { ok: false, reason: 'malformed' };
    const candidate = parsed as Partial<Payload>;
    if (typeof candidate.a !== 'string' || candidate.a.length === 0) return { ok: false, reason: 'malformed' };
    if (typeof candidate.s !== 'string') return { ok: false, reason: 'malformed' };
    if (typeof candidate.x !== 'number' || !Number.isFinite(candidate.x)) return { ok: false, reason: 'malformed' };
    payload = { a: candidate.a, s: candidate.s, x: candidate.x };
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (payload.x * 1000 <= now) return { ok: false, reason: 'expired' };

  /* An empty subject is a token minted for a signed-out view and is redeemable
     by anyone, including a member who has since signed in — the page really did
     serve the spot, and refusing that listener would drop honest delivery. A
     token minted FOR a member is redeemable only by that member. */
  if (payload.s.length > 0) {
    const caller = typeof subject === 'string' ? subject : '';
    if (!constantTimeEqual(payload.s, caller)) return { ok: false, reason: 'wrong_listener' };
  }

  return { ok: true, adId: payload.a, subject: payload.s };
}

/** `mkt_<Ad.id>` is the only clip shape that names a real campaign; a built-in
 *  placeholder has no `Ad` row to bill. One definition, so the minting side and
 *  the billing side cannot disagree about what is chargeable. */
export function marketplaceAdIdFromClipId(clipId: string | null | undefined): string | null {
  if (typeof clipId !== 'string' || !clipId.startsWith('mkt_')) return null;
  const adId = clipId.slice(4);
  return adId.length > 0 ? adId : null;
}
