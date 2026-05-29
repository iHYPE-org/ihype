import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdminSession } from '@/lib/permissions';
import { db } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session || !isAdminSession(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const flags = await db.featureFlag.findMany({ orderBy: { key: 'asc' } });
  return NextResponse.json(flags);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || !isAdminSession(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { key?: string; enabled?: boolean; description?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  if (!body.key) return NextResponse.json({ error: 'key required' }, { status: 400 });

  const flag = await db.featureFlag.upsert({
    where: { key: body.key },
    create: { key: body.key, enabled: body.enabled ?? false, description: body.description },
    update: { enabled: body.enabled ?? false },
  });
  return NextResponse.json(flag);
}
