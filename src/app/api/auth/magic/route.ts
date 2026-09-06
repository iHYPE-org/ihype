import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildAuthSessionCookie } from '@/lib/auth-session';
import { checkAndRecordLogin } from '@/lib/login-security';
import { resolvePostAuthRedirect } from '@/lib/auth-redirects';
import { hashMagicLinkToken } from '@/lib/magic-link-token';
import { planRedemption } from '@/lib/review-access';
import { log } from '@/lib/logger';
import { readRuntimeEnv } from '@/lib/runtime-env';
import { deferWork } from '@/lib/defer-work';

export const dynamic = 'force-dynamic';

/**
 * ## Why a GET no longer signs anyone in
 *
 * This route used to consume the token on GET, and that made the link
 * destructible by anything that merely LOOKED at it. Corporate mail security
 * — Microsoft Defender Safe Links and every scanner like it — fetches each URL
 * in a message before the recipient sees it. The scanner's fetch spent the
 * token, the member clicked and was told their link had expired, and the
 * obvious remedy (ask for another one) produced another link the same scanner
 * burned. On a product whose only two ways in are a passkey and this email,
 * that is not an inconvenience: it locks every member behind such a gateway
 * out permanently. Recorded as a follow-up by the 2026-09-02 sweep.
 *
 * So the two halves are split along the line the web already draws: GET is
 * safe and idempotent, POST is the one that changes something. GET reads
 * nothing and writes nothing — it forwards to a confirm page that posts the
 * token back. A scanner follows the redirect, renders a page, and spends
 * nothing.
 *
 * The cost is one extra page load, and a click for anyone without JavaScript.
 * That is the whole price of the link surviving contact with a mail gateway.
 *
 * Old links keep working: they point here, and here still knows what to do
 * with them.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token = searchParams.get('token');

  if (!token || typeof token !== 'string') {
    return NextResponse.redirect(new URL('/login?error=invalid_magic_link', request.url));
  }

  // Deliberately no database read, not even to check the token exists. A
  // lookup here would hand a scanner — or anyone else — an oracle for whether
  // a token is live, and would put a query on the path of every automated
  // fetch of every link we send. The confirm page's POST is where the token
  // meets the database.
  const forwarded = new URLSearchParams({ token });
  const callbackUrl = searchParams.get('callbackUrl');
  if (callbackUrl) forwarded.set('callbackUrl', callbackUrl);
  return NextResponse.redirect(new URL(`/auth/confirm?${forwarded}`, request.url));
}

/**
 * POST — the half that spends the token.
 *
 * Reached from the confirm page's form (or by any client that posts the token
 * directly). Everything below is the consumption logic exactly as it was when
 * it lived under GET, including the atomic conditional update `lint-source`
 * checks for.
 */
export async function POST(request: NextRequest) {
  /* Login CSRF: without this, a third-party page could post the ATTACKER's
     token into a victim's browser and quietly sign them into an account the
     attacker controls, where everything the victim then does is visible to
     them.

     Judged on `Sec-Fetch-Site`, the same mechanism and the same reasoning as
     the sign-out route, and deliberately NOT by comparing `Origin` against
     `request.nextUrl.origin`. That comparison is the obvious version and it
     is a production outage waiting to happen: this app sits behind Cloudflare
     with middleware that rewrites scheme and host, so the origin Next derives
     is not guaranteed to be the one the browser stamped on the request, and
     any disagreement — http against https, www against apex — would refuse
     every real sign-in while looking perfectly correct in review. A header
     the browser sets to a fixed vocabulary cannot drift like that.

     An absent header is a client that is not a browser (a script, the
     acceptance walk), which is not a browser being steered by another site. */
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.redirect(new URL('/login?error=invalid_magic_link', request.url), 303);
  }

  const { token, callbackUrl } = await readPostedToken(request);

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=invalid_magic_link', request.url), 303);
  }

  const searchParams = new URLSearchParams();
  if (callbackUrl) searchParams.set('callbackUrl', callbackUrl);

  const tokenHash = hashMagicLinkToken(token);
  const now = new Date();

  let user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    role: string;
    emailVerified: Date | null;
    userSecurityVersion: number;
    lastLoginCountry: string | null;
  } | null = null;

  try {
    user = await db.$transaction(async (tx) => {
      const record = await tx.magicLinkToken.findUnique({
        where: { token: tokenHash },
        select: { id: true, userId: true, expiresAt: true, used: true, remainingUses: true },
      });

      if (!record || record.used || record.expiresAt <= now) return null;

      /* A member's link is single-use and `remainingUses` is null for it, which
         `planRedemption` maps to exactly the previous behaviour. A store-review
         link (see `src/lib/review-access.ts`) carries a small count instead,
         because a reviewer cannot ask us for another one mid-review. */
      const plan = planRedemption(record.remainingUses);
      if (!plan.allowed) return null;

      /* Still one atomic conditional write, and the guard now includes the
         COUNT as well as `used`: two concurrent redemptions of a multi-use
         link must spend two, not one. Matching on the value we read is what
         makes this a compare-and-set rather than a read-then-write — the same
         race `/api/shows/[showId]/scan` was fixed for. */
      const consumed = await tx.magicLinkToken.updateMany({
        where: {
          id: record.id,
          used: false,
          expiresAt: { gt: now },
          remainingUses: record.remainingUses,
        },
        data: { used: plan.markUsed, remainingUses: plan.nextRemaining },
      });
      if (consumed.count !== 1) return null;

      const foundUser = await tx.user.findUnique({
        where: { id: record.userId },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
          emailVerified: true,
          userSecurityVersion: true,
          lastLoginCountry: true,
        },
      });
      if (!foundUser) return null;

      if (!foundUser.emailVerified) {
        const emailVerified = new Date();
        await tx.user.update({ where: { id: foundUser.id }, data: { emailVerified } });
        return { ...foundUser, emailVerified };
      }

      return foundUser;
    });
  } catch (error) {
    log.error('[magic-link]', error instanceof Error ? error : { error: String(error) }, 'atomic token consumption failed');
    return NextResponse.redirect(new URL('/login?error=ml_db_error', request.url), 303);
  }

  if (!user) {
    return NextResponse.redirect(new URL('/login?error=expired_magic_link', request.url), 303);
  }

  if (!readRuntimeEnv('AUTH_SECRET')) {
    log.error('[magic-link]', null, 'AUTH_SECRET is not set');
    return NextResponse.redirect(new URL('/login?error=ml_no_secret', request.url), 303);
  }

  const sessionCookie = await buildAuthSessionCookie(user);
  if (!sessionCookie) {
    log.error(
      '[magic-link]',
      { userId: user.id, securityVersion: user.userSecurityVersion },
      'buildAuthSessionCookie returned null',
    );
    return NextResponse.redirect(new URL('/login?error=ml_cookie_error', request.url), 303);
  }

  deferWork(checkAndRecordLogin(user, request), 'magic-link-login-security');

  const rawCallback = searchParams.get('callbackUrl');
  /**
   * An ADMIN lands where every other member lands.
   *
   * This used to send `role === 'ADMIN'` straight to `/admin`, and that was
   * the whole reason signing in as an administrator ended on a blank
   * `/admin/device-register`: `/admin`'s layout redirects there whenever the
   * device cookie is missing, which is every new browser. So the platform
   * owner's first screen after sign-in was a lockout page, and they never saw
   * the product they were signing in to.
   *
   * Admin is a capability, not a home. The console is reached deliberately
   * from the ADMIN MODE control in the shell.
   */
  const defaultDest = user.role === 'ADVERTISER' ? '/advertise/dashboard' : undefined;
  const dest = resolvePostAuthRedirect(rawCallback ?? defaultDest);

  /* 303, so the browser turns the form POST into a GET of the destination.
     A 307 would re-post the token to the page we are sending them to. */
  const response = NextResponse.redirect(new URL(dest, request.url), 303);
  response.cookies.set(sessionCookie);
  return response;
}

/**
 * The confirm page posts a form; a script may post JSON. Accept both, and
 * treat an unreadable body as an absent token rather than throwing.
 */
async function readPostedToken(request: NextRequest): Promise<{ token: string | null; callbackUrl: string | null }> {
  const contentType = request.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/json')) {
      const body = (await request.json()) as Record<string, unknown>;
      return {
        token: typeof body?.token === 'string' ? body.token : null,
        callbackUrl: typeof body?.callbackUrl === 'string' ? body.callbackUrl : null,
      };
    }
    const form = await request.formData();
    const token = form.get('token');
    const callbackUrl = form.get('callbackUrl');
    return {
      token: typeof token === 'string' && token ? token : null,
      callbackUrl: typeof callbackUrl === 'string' && callbackUrl ? callbackUrl : null,
    };
  } catch {
    return { token: null, callbackUrl: null };
  }
}
