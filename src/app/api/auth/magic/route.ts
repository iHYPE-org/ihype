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

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token = searchParams.get('token');

  if (!token || typeof token !== 'string') {
    return NextResponse.redirect(new URL('/login?error=invalid_magic_link', request.url));
  }

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
    return NextResponse.redirect(new URL('/login?error=ml_db_error', request.url));
  }

  if (!user) {
    return NextResponse.redirect(new URL('/login?error=expired_magic_link', request.url));
  }

  if (!readRuntimeEnv('AUTH_SECRET')) {
    log.error('[magic-link]', null, 'AUTH_SECRET is not set');
    return NextResponse.redirect(new URL('/login?error=ml_no_secret', request.url));
  }

  const sessionCookie = await buildAuthSessionCookie(user);
  if (!sessionCookie) {
    log.error(
      '[magic-link]',
      { userId: user.id, securityVersion: user.userSecurityVersion },
      'buildAuthSessionCookie returned null',
    );
    return NextResponse.redirect(new URL('/login?error=ml_cookie_error', request.url));
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

  const response = NextResponse.redirect(new URL(dest, request.url));
  response.cookies.set(sessionCookie);
  return response;
}
