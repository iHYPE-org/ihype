import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });

  const rl = await consumeRateLimit(`seeds:${session.user.id}`, { limit: 120, windowMs: 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ ok: false }, { status: 429 });

  const { id, action } = await params;
  if (!['save', 'skip', 'hype'].includes(action)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    const media = await db.artistMediaAsset.findUnique({
      where: { id },
      select: { id: true, profileId: true },
    });

    if (!media) {
      return NextResponse.json({ ok: false, error: 'Seed media was not found.' }, { status: 404 });
    }

    await db.seed.create({
      data: { userId: session.user.id, mediaId: id, action },
    });

    if (action === 'hype') {
      // createMany with skipDuplicates returns how many rows were actually inserted.
      // Only increment hypeCount when a new record is created, not on duplicate hypes.
      const { count } = await db.profileHypeEvent.createMany({
        data: [{ userId: session.user.id, profileId: media.profileId }],
        skipDuplicates: true,
      });
      if (count > 0) {
        await db.profile.update({
          where: { id: media.profileId },
          data: { hypeCount: { increment: 1 } },
        });
      }
    }
  } catch (error) {
    console.error('[discover/seeds] failed to record action', error);
    return NextResponse.json({ ok: false, error: 'Could not record seed action.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
