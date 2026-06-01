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

  const record = await db.magicLinkToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, name: true, email: true, image: true, role: true, emailVerified: true } } }
  });

  if (!record || record.used || record.expiresAt < new Date()) {
    return NextResponse.redirect(new URL('/login?error=expired_magic_link', request.url));
  }

  await db.magicLinkToken.update({ where: { id: record.id }, data: { used: true } });

  const sessionCookie = await buildAuthSessionCookie(record.user);
  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login?error=server_error', request.url));
  }

  // Resolve destination: admin users go to /admin, others go to /home.
  // Also honour an optional ?callbackUrl= param set by the link sender.
  const rawCallback = searchParams.get('callbackUrl');
  const defaultDest = record.user.role === 'ADMIN' ? '/admin' : undefined;
  const dest = resolvePostAuthRedirect(rawCallback ?? defaultDest);

  const response = NextResponse.redirect(new URL(dest, request.url));
  response.cookies.set(sessionCookie);
  return response;
}
