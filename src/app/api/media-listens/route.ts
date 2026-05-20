import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const schema = z.object({
  mediaId: z.string().min(1).max(128),
  title: z.string().min(1).max(200),
  mediaUrl: z.string().url().max(2048),
  artistName: z.string().min(1).max(160),
  artistProfileSlug: z.string().min(1).max(160).optional()
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  try {
    const payload = schema.parse(await request.json());

    await db.mediaListen.upsert({
      where: {
        userId_mediaId: {
          userId: session.user.id,
          mediaId: payload.mediaId
        }
      },
      update: {
        title: payload.title,
        mediaUrl: payload.mediaUrl,
        artistName: payload.artistName,
        artistProfileSlug: payload.artistProfileSlug ?? null,
        completedAt: new Date()
      },
      create: {
        userId: session.user.id,
        mediaId: payload.mediaId,
        title: payload.title,
        mediaUrl: payload.mediaUrl,
        artistName: payload.artistName,
        artistProfileSlug: payload.artistProfileSlug ?? null,
        completedAt: new Date()
      }
    });

    return NextResponse.json({ recorded: true });
  } catch (err) {
    console.error('[media-listens]', err);
    return NextResponse.json({ error: 'Invalid media listen payload' }, { status: 400 });
  }
}
