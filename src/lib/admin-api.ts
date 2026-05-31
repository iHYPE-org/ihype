import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdminSession } from '@/lib/permissions';

export async function requireAdminApi() {
  const session = await auth();

  if (!session?.user?.id || !isAdminSession(session)) {
    return {
      session: null,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    };
  }

  return { session, response: null };
}
