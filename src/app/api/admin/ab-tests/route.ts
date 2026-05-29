import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!isAdminSession(session)) return NextResponse.json({ error: 'Admin required.' }, { status: 403 });

  const tests = await db.aBTest.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ tests });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!isAdminSession(session)) return NextResponse.json({ error: 'Admin required.' }, { status: 403 });

  let body: { key?: unknown; description?: unknown; enabled?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const key = typeof body.key === 'string' ? body.key.trim() : '';
  if (!key) return NextResponse.json({ error: 'key is required.' }, { status: 400 });

  const test = await db.aBTest.upsert({
    where: { key },
    create: {
      key,
      description: typeof body.description === 'string' ? body.description : undefined,
      enabled: body.enabled === true,
    },
    update: {
      description: typeof body.description === 'string' ? body.description : undefined,
      enabled: body.enabled === true,
    },
  });

  return NextResponse.json({ test }, { status: 201 });
}
