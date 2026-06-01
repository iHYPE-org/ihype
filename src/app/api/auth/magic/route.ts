import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildAuthSessionCookie } from '@/lib/auth-session';
import { resolvePostAuthRedirect } from '@/lib/auth-redirects';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token = searchParams.get('token');

  if (!token || typeof token !== 'string') {
    return NextResponse.redirect(new URL('/login?error=invalid_magic_link', request.url));
  }

  let record;
  try {
    record = await db.magicLinkToken.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true, name: true, email: true, image: true,
            role: true, emailVerified: true, userSecurityVersion: true,
          }
        }
      }
    });
  } catch (err) {
    console.error('[magic-link] DB lookup failed:', err);
    return NextResponse.redirect(new URL('/login?error=ml_db_error', request.url));
  }

  if (!record || record.used || record.expiresAt < new Date()) {
    return NextResponse.redirect(new URL('/login?error=expired_magic_link', request.url));
  }

  try {
    await db.magicLinkToken.update({ where: { id: record.id }, data: { used: true } });
  } catch (err) {
    console.error('[magic-link] Token mark-used failed:', err);
    // non-fatal — proceed with sign-in
  }

  if (!process.env.AUTH_SECRET) {
    console.error('[magic-link] AUTH_SECRET is not set');
    return NextResponse.redirect(new URL('/login?error=ml_no_secret', request.url));
  }

  const sessionCookie = await buildAuthSessionCookie(record.user);
  if (!sessionCookie) {
    console.error('[magic-link] buildAuthSessionCookie returned null for user', record.user.id, 'securityVersion:', record.user.userSecurityVersion);
    return NextResponse.redirect(new URL('/login?error=ml_cookie_error', request.url));
  }

  const rawCallback = searchParams.get('callbackUrl');
  const defaultDest = record.user.role === 'ADMIN' ? '/admin' : undefined;
  const dest = resolvePostAuthRedirect(rawCallback ?? defaultDest);

  const response = NextResponse.redirect(new URL(dest, request.url));
  response.cookies.set(sessionCookie);
  return response;
}
