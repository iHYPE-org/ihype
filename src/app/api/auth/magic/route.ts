import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildAuthSessionCookie } from '@/lib/auth-session';
import { checkAndRecordLogin } from '@/lib/login-security';
import { resolvePostAuthRedirect } from '@/lib/auth-redirects';
import { hashMagicLinkToken } from '@/lib/magic-link-token';
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
        select: { id: true, userId: true, expiresAt: true, used: true },
      });

      if (!record || record.used || record.expiresAt <= now) return null;

      const consumed = await tx.magicLinkToken.updateMany({
        where: { id: record.id, used: false, expiresAt: { gt: now } },
        data: { used: true },
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
