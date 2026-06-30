import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSceneWrapped } from '@/lib/sceneWrapped';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 });
    }

    const wrapped = await getSceneWrapped(session.user.id);
    return NextResponse.json(wrapped);
  } catch (err) {
    console.error('[api/me/wrapped] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
