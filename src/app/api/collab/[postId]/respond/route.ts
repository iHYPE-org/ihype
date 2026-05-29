import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const { postId } = await params;
  const ip = readClientAddress(request);
  const rl = await consumeRateLimit(`collab-respond:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });

  let parsed: { profileId?: string; message?: string };
  try { parsed = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const { profileId, message } = parsed;
  if (!profileId || !message?.trim()) {
    return NextResponse.json({ error: 'profileId and message are required.' }, { status: 400 });
  }

  // Verify post exists and is active
  const post = await db.collabPost.findUnique({ where: { id: postId, active: true } });
  if (!post) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });

  // Verify profile belongs to user
  const profile = await db.profile.findUnique({ where: { id: profileId, ownerId: session.user.id } });
  if (!profile) return NextResponse.json({ error: 'Profile not found or not yours.' }, { status: 403 });

  try {
    const response = await db.collabResponse.create({
      data: { postId, profileId, userId: session.user.id, message: message.trim() },
    });
    return NextResponse.json({ response });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'You already responded to this post.' }, { status: 409 });
    }
    throw err;
  }
}
