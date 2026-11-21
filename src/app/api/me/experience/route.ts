import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { experienceSchema, parseExperience } from '@/lib/member-experience';

export const dynamic = 'force-dynamic';
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { experiencePreferences: true } });
  if (!user) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  return NextResponse.json({ preferences: parseExperience(user.experiencePreferences) }, { headers: { 'Cache-Control': 'private, no-store' } });
}
export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  const parsed = experienceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid experience settings.' }, { status: 400 });
  await db.user.update({ where: { id: session.user.id }, data: { experiencePreferences: parsed.data } });
  return NextResponse.json({ preferences: parsed.data }, { headers: { 'Cache-Control': 'private, no-store' } });
}
