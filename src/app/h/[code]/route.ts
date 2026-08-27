import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import { REFERRAL_COOKIE, REFERRAL_COOKIE_MAX_AGE } from '@/lib/referral-attribution';

export const dynamic = 'force-dynamic';

/**
 * Short HYPE Link — `https://ihype.org/h/{code}`, where `{code}` is a member's
 * hexId. Following one is how a promoter earns from the 10% pool.
 *
 * ## This is a ROUTE HANDLER, and that is not a style choice
 *
 * It was a `page.tsx`, and it was broken in production the whole time it was
 * one. A Server Component may READ cookies and may not WRITE them — Next throws
 * `Cookies can only be modified in a Server Action or Route Handler` — so
 * `store.set(REFERRAL_COOKIE, …)` threw on every single visit, before the
 * redirect below it could run. What a visitor got was the error boundary: no
 * cookie, no redirect to signup, no attribution, nothing. Verified against
 * production on 2026-08-27 — `/h/<code>` answered 200 with a React error
 * payload and no `set-cookie` header at all.
 *
 * It went unnoticed because nothing about it looks broken from inside the
 * repository: the code reads correctly, the audit write succeeds, and the page
 * returns HTTP 200. Only following the link shows it, and the people who follow
 * HYPE links are not the people building the app. An e2e now does.
 *
 * A route handler is also strictly better here for a second reason: `redirect()`
 * from a page under the root `loading.tsx` boundary cannot emit a 307 — it
 * streams a 200 carrying a `<meta refresh>` — whereas `NextResponse.redirect`
 * is a real redirect with the cookie attached to it.
 *
 * ## What it does
 *
 * The code goes into a cookie first, so it survives signup and any amount of
 * browsing before the purchase — ticket attribution is read at the moment of
 * purchase, and by then a query parameter is long gone. Then:
 *
 *   - **signed out** → `/register?ref=<code>`, because you have to have an
 *     account to hold a ticket, and asking for it here is honest about that.
 *     The query parameter is kept as well as the cookie: registration uses it
 *     for referral attribution on the ACCOUNT, which is a separate credit from
 *     the ticket.
 *   - **signed in** → straight into the app. No signup wall for someone who is
 *     already a member; the cookie carries their friend's credit to whatever
 *     they buy.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const ref = code.trim().slice(0, 80);
  const session = await auth();

  const destination = session?.user?.id
    ? '/app/map'
    : `/register?ref=${encodeURIComponent(ref)}`;
  const response = NextResponse.redirect(new URL(destination, request.url));

  if (ref) {
    await recordAuditEvent({
      action: 'referral_click',
      entityType: 'referral',
      entityId: ref,
    }).catch(() => {});

    response.cookies.set(REFERRAL_COOKIE, ref, {
      maxAge: REFERRAL_COOKIE_MAX_AGE,
      // Server-read only: nothing in the browser needs it, and keeping it out
      // of document.cookie keeps it out of anything that scrapes the page.
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
  }

  return response;
}
