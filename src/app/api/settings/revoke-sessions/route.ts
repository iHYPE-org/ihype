import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * POST /api/settings/revoke-sessions
 *
 * Increments the user's `userSecurityVersion`, which invalidates all existing
 * JWT sessions on the next `trigger === 'update'` check in the jwt callback.
 * Effectively logs out all other devices.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { userSecurityVersion: { increment: 1 } }
  });

  return NextResponse.json({ success: true });
}
