import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getHypeStreak } from '@/lib/hype-streak';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ streak: 0, daysActive: 0 });

    const result = await getHypeStreak(session.user.id);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[api/hype-streak] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
