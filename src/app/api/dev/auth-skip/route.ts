import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildAuthSessionCookie } from '@/lib/auth-session';
import { isLocalAuthSkipEnabled } from '@/lib/local-auth-skip';
import { resolvePostAuthRedirect, WORKBENCH_PATH } from '@/lib/auth-redirects';

const PREVIEW_EMAIL = 'fan@ihype.org';

export async function GET(request: NextRequest) {
  if (!isLocalAuthSkipEnabled(request.nextUrl.hostname, process.env.LOCAL_AUTH_SKIP)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const user = await db.user.upsert({
    where: { email: PREVIEW_EMAIL },
    update: {},
    create: {
      email: PREVIEW_EMAIL,
      username: 'fan',
      name: 'Night Owl',
      role: 'FAN',
      emailVerified: new Date(),
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      emailVerified: true,
      userSecurityVersion: true,
    },
  });

  const sessionCookie = await buildAuthSessionCookie(user);
  if (!sessionCookie) {
    return NextResponse.json({ error: 'Local preview session could not be created' }, { status: 503 });
  }

  const destination = resolvePostAuthRedirect(
    request.nextUrl.searchParams.get('callbackUrl') ?? WORKBENCH_PATH,
  );
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.cookies.set(sessionCookie);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

