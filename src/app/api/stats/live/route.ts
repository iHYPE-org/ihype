import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const [listeningNow, hypedToday] = await Promise.all([
    db.mediaListen.count({ where: { createdAt: { gte: new Date(Date.now() - 3600000) } } }),
    db.profileHypeEvent.count({ where: { createdAt: { gte: new Date(Date.now() - 86400000) } } }),
  ]).catch(() => [0, 0] as [number, number]);

  return NextResponse.json({ listeningNow, hypedToday });
}
