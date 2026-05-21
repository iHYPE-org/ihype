import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

export async function GET() {
  const requests = await db.featureRequest.findMany({
    where: { status: { not: 'declined' } },
    orderBy: [{ votes: 'desc' }, { createdAt: 'desc' }],
    take: 50
  });
  return NextResponse.json({ requests });
}

export async function POST(request: NextRequest) {
  const ip = readClientAddress(request);
  let body: { action?: string; id?: string; title?: string; description?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  if (body.action === 'vote' && body.id) {
    // Require login for votes so they reflect real user preferences
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Login required to vote.' }, { status: 401 });
    const rl = await consumeRateLimit(`feedback-vote:${session.user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limit.' }, { status: 429 });
    const updated = await db.featureRequest.update({ where: { id: body.id }, data: { votes: { increment: 1 } } });
    return NextResponse.json({ ok: true, votes: updated.votes });
  }

  const rl = await consumeRateLimit(`feedback-create:${ip}`, { limit: 2, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit.' }, { status: 429 });
  if (!body.title?.trim() || !body.description?.trim()) return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });

  const session = await auth();
  const fr = await db.featureRequest.create({
    data: { userId: session?.user?.id ?? null, title: body.title.trim(), description: body.description.trim() }
  });
  return NextResponse.json({ ok: true, request: fr }, { status: 201 });
}
