import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db, withDbRetry } from '@/lib/db';
import { createHexId } from '@/lib/hex-id';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function deriveTitleFromFileName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Artist upload';
  }

  return trimmed
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const profileId = String(formData.get('profileId') ?? '').trim();
    const requestedTitle = String(formData.get('title') ?? '').trim();
    const notesValue = String(formData.get('notes') ?? '').trim();
    const file = formData.get('file');

    if (!profileId) {
      return NextResponse.json({ error: 'Artist profile is required.' }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Choose an audio file to upload.' }, { status: 400 });
    }

    if (!file.type.startsWith('audio/')) {
      return NextResponse.json({ error: 'Only audio files can be uploaded.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'Audio uploads are limited to 10MB.' }, { status: 400 });
    }

    const profile = await withDbRetry(() =>
      db.profile.findUnique({
        where: { id: profileId },
        select: {
          id: true,
          ownerId: true,
          type: true
        }
      })
    );

    if (!profile || profile.type !== 'ARTIST') {
      return NextResponse.json({ error: 'Artist profile not found.' }, { status: 404 });
    }

    if (profile.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Only the artist who owns this page can upload media.' }, { status: 403 });
    }

    const title = (requestedTitle || deriveTitleFromFileName(file.name)).slice(0, 160);
    const fileDataBase64 = Buffer.from(await file.arrayBuffer()).toString('base64');
    const hexId = createHexId();

    const updatedProfile = await withDbRetry(() =>
      db.profile.update({
        where: { id: profile.id },
        data: {
          songUploadCount: {
            increment: 1
          },
          mediaUploads: {
            create: {
              hexId,
              title,
              notes: notesValue || null,
              originalFileName: file.name || `${hexId}.audio`,
              mimeType: file.type,
              fileSizeBytes: file.size,
              fileDataBase64
            }
          }
        },
        select: {
          mediaUploads: {
            where: { hexId },
            select: {
              hexId: true,
              title: true,
              notes: true,
              mimeType: true,
              fileSizeBytes: true,
              createdAt: true
            }
          }
        }
      })
    );
    const asset = updatedProfile.mediaUploads[0];

    if (!asset) {
      throw new Error('Artist media upload did not return the created asset.');
    }

    return NextResponse.json({
      asset: {
        ...asset,
        url: `/api/media/${asset.hexId}`,
        shareUrl: `/api/media/${asset.hexId}`
      }
    });
  } catch (error) {
    console.error('Artist media upload failed', error);
    return NextResponse.json({ error: 'Could not upload this track.' }, { status: 500 });
  }
}
