/**
 * Whether THIS browser asked for the magic link it is now opening.
 *
 * `/auth/confirm` used to submit its form the moment it mounted. That made it a
 * login-CSRF page: anyone can request a magic link for their OWN account, take
 * the token out of their own inbox and send the `/auth/confirm?token=…` URL (or
 * the `/api/auth/magic` one that forwards to it) to somebody else — whose
 * browser then signs in to the sender's account without a click, and whatever
 * they upload, buy or type next lands in an account somebody else controls.
 * The route's cross-site check cannot see it, because the auto-submit is
 * same-origin by construction.
 *
 * So the request routes set this cookie on the browser that asked, and the
 * confirm page auto-submits only when it is present. The common case — asked
 * here, opened here — is unchanged. Opened on a different device, or opened
 * from somebody else's link, it waits for a press under a sentence saying whose
 * link continues. Only whether a request was made is recorded: the cookie
 * carries no address and no account, so it says nothing to anyone who reads
 * it, and it is set whether or not an account exists, so it cannot be used to
 * learn that either.
 *
 * Dependency-light (no `next/*`): the routes set it through `NextResponse`, the
 * page reads it through `cookies()`, and both import the name from here.
 */

export const MAGIC_LINK_PENDING_COOKIE = 'ihype_magic_pending';

/** A magic link lives fifteen minutes; the marker outlives it slightly. */
export const MAGIC_LINK_PENDING_MAX_AGE_SECONDS = 20 * 60;

export function magicLinkPendingCookie(secure: boolean) {
  return {
    name: MAGIC_LINK_PENDING_COOKIE,
    value: '1',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge: MAGIC_LINK_PENDING_MAX_AGE_SECONDS,
  };
}
