import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ streak: 0 });

    // Get hype actions from AuditLog for this user, last 60 days
    const logs = await db.auditLog.findMany({
      where: {
        actorUserId: session.user.id,
        action: { startsWith: 'hype_' },
        createdAt: { gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }).catch(() => []);

    // Compute consecutive days streak (UTC dates)
    const days = new Set(logs.map(l => l.createdAt.toISOString().slice(0, 10)));
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 60; i++) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (days.has(key)) streak++;
      else if (i > 0) break; // allow today to not have hyped yet (i=0)
    }

    return NextResponse.json({ streak, daysActive: days.size });
  } catch (err) {
    console.error('[api/hype-streak] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
