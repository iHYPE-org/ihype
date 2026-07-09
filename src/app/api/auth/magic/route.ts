import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildAuthSessionCookie } from '@/lib/auth-session';
import { checkAndRecordLogin } from '@/lib/login-security';
import { resolvePostAuthRedirect } from '@/lib/auth-redirects';
import { hashMagicLinkToken } from '@/lib/magic-link-token';

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
    console.error('[magic-link] atomic token consumption failed:', error);
    return NextResponse.redirect(new URL('/login?error=ml_db_error', request.url));
  }

  if (!user) {
    return NextResponse.redirect(new URL('/login?error=expired_magic_link', request.url));
  }

  if (!process.env.AUTH_SECRET) {
    console.error('[magic-link] AUTH_SECRET is not set');
    return NextResponse.redirect(new URL('/login?error=ml_no_secret', request.url));
  }

  const sessionCookie = await buildAuthSessionCookie(user);
  if (!sessionCookie) {
    console.error(
      '[magic-link] buildAuthSessionCookie returned null for user',
      user.id,
      'securityVersion:',
      user.userSecurityVersion,
    );
    return NextResponse.redirect(new URL('/login?error=ml_cookie_error', request.url));
  }

  void checkAndRecordLogin(user, request);

  const rawCallback = searchParams.get('callbackUrl');
  const defaultDest = user.role === 'ADMIN' ? '/admin' : undefined;
  const dest = resolvePostAuthRedirect(rawCallback ?? defaultDest);

  const response = NextResponse.redirect(new URL(dest, request.url));
  response.cookies.set(sessionCookie);
  return response;
}
