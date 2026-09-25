import { createHash, randomBytes } from 'crypto';

/**
 * Whether THIS browser asked for THE magic link it is now opening.
 *
 * `/auth/confirm` used to submit its form the moment it mounted. That made it a
 * login-CSRF page: anyone can request a magic link for their OWN account, take
 * the token out of their own inbox and send the `/auth/confirm?token=…` URL (or
 * the `/api/auth/magic` one that forwards to it) to somebody else — whose
 * browser then signs in to the sender's account without a click, and whatever
 * they upload, buy or type next lands in an account somebody else controls.
 * The route's `Sec-Fetch-Site` refusal cannot see it, because the auto-submit
 * is same-origin by construction.
 *
 * ## The marker names the link, not just "a request happened" (2026-09-25, row 519)
 *
 * The first version of this (row 516) set `1` and auto-submitted any token
 * while it was present — so a member who had asked for their own link in the
 * last twenty minutes would still auto-submit an attacker's. Now the request
 * routes store a one-way digest of each token this browser asked for (up to
 * {@link MAX_PENDING}), and the page auto-submits only when the digest of the
 * token in its URL is in the list. The digest is domain-separated from the
 * token's database hash, so the cookie holds nothing a lookup could use, and it
 * cannot be reversed into a token.
 *
 * ## Why not `document.referrer` or `Sec-Fetch-Site`
 *
 * Both were considered and both fail the member. A link tapped in webmail
 * (Gmail, Outlook on the web) arrives cross-site, exactly like an attacker's
 * page, so a referrer rule costs every webmail reader a tap; and a link an
 * attacker EMAILS to the victim opens from a mail app with no referrer at all,
 * exactly like the member's own, so the rule stops nothing there. The digest is
 * indifferent to where the tap came from: the member's own link auto-submits
 * from a mail app, from webmail, from the iOS app's universal link (same
 * WebView as the request); anyone else's link waits for a press.
 *
 * What still costs a tap: asking on one device and opening on another. That
 * browser never asked, so it cannot know the link is yours; it shows the button
 * under a sentence saying whose account a link signs in to.
 *
 * Mail scanners are unchanged: they do not run the page's script, so nothing
 * submits, and GET spends nothing either way (magic/route.ts).
 *
 * ## Revealing nothing
 *
 * A request for an unknown address, a refused admin address or a rate-limited
 * address gets a DECOY digest of random bytes, so the cookie's presence and
 * length say nothing about whether an account exists.
 */

export const MAGIC_LINK_PENDING_COOKIE = 'ihype_magic_pending';

/** A magic link lives fifteen minutes; the marker outlives it slightly. */
export const MAGIC_LINK_PENDING_MAX_AGE_SECONDS = 20 * 60;

/** Links this browser can have outstanding at once and still auto-submit. */
export const MAX_PENDING = 3;

const DIGEST_PREFIX = 'ihype:magic-link-pending:v1:';

/** One-way, domain-separated digest of a token (truncated: 128 bits is plenty to match on). */
export function pendingDigest(token: string): string {
  return createHash('sha256').update(DIGEST_PREFIX + token, 'utf8').digest('hex').slice(0, 32);
}

/** A digest that matches no token, for requests that sent nothing. */
export function decoyDigest(): string {
  return randomBytes(16).toString('hex');
}

function parse(existing: string | null | undefined): string[] {
  return (existing ?? '').split('.').filter((part) => /^[0-9a-f]{32}$/.test(part));
}

/** The cookie value after this request: newest first, capped. */
export function appendPending(existing: string | null | undefined, digest: string): string {
  return [digest, ...parse(existing).filter((d) => d !== digest)].slice(0, MAX_PENDING).join('.');
}

/** The cookie value once `token` is spent. */
export function removePending(existing: string | null | undefined, token: string): string {
  const spent = pendingDigest(token);
  return parse(existing).filter((d) => d !== spent).join('.');
}

/** Whether this browser asked for exactly this link. */
export function wasRequestedHere(existing: string | null | undefined, token: string | null | undefined): boolean {
  if (!token) return false;
  return parse(existing).includes(pendingDigest(token));
}

export function magicLinkPendingCookie(value: string, secure: boolean) {
  return {
    name: MAGIC_LINK_PENDING_COOKIE,
    value,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge: value ? MAGIC_LINK_PENDING_MAX_AGE_SECONDS : 0,
  };
}

/** Read a cookie off a raw request, for routes handed a plain `Request`. */
export function readPendingCookie(request: Request): string | null {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === MAGIC_LINK_PENDING_COOKIE) return rest.join('=');
  }
  return null;
}
