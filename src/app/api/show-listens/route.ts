import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const schema = z.object({
  showId: z.string().min(1).max(128),
  title: z.string().min(1).max(200),
  showSlug: z.string().min(1).max(160),
  playbackUrl: z.string().url().max(2048)
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  try {
    const payload = schema.parse(await request.json());

    await db.showListen.upsert({
      where: {
        userId_showId: {
          userId: session.user.id,
          showId: payload.showId
        }
      },
      update: {
        title: payload.title,
        showSlug: payload.showSlug,
        playbackUrl: payload.playbackUrl,
        completedAt: new Date()
      },
      create: {
        userId: session.user.id,
        showId: payload.showId,
        title: payload.title,
        showSlug: payload.showSlug,
        playbackUrl: payload.playbackUrl,
        completedAt: new Date()
      }
    });

    return NextResponse.json({ recorded: true });
  } catch (err) {
    console.error('[show-listens]', err);
    return NextResponse.json({ error: 'Invalid show listen payload' }, { status: 400 });
  }
}
