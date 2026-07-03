import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db, withDbRetry } from '@/lib/db';
import { createHexId } from '@/lib/hex-id';
import { validateArtistMediaUpload } from '@/lib/media-validation';
import { isBlobMediaStorageAvailable, uploadArtistMediaToBlob } from '@/lib/media-storage';
import { canManageOwnedResource } from '@/lib/permissions';
import { areDatabaseMediaUploadsEnabledRuntime } from '@/lib/runtime-flags';
import { validateAudioMagicBytes } from '@/lib/validate-upload';
import { parseAudioDuration } from '@/lib/audio-duration';

export const dynamic = 'force-dynamic';

const MAX_AUDIO_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get('profileId')?.trim() ?? '';

  if (!profileId) {
    return NextResponse.json({ error: 'profileId is required.' }, { status: 400 });
  }

  const profile = await withDbRetry(() =>
    db.profile.findUnique({
      where: { id: profileId },
      select: { id: true, ownerId: true, type: true }
    })
  );

  if (!profile || !['ARTIST', 'DJ'].includes(profile.type)) {
    return NextResponse.json({ error: 'Artist profile not found.' }, { status: 404 });
  }

  if (!canManageOwnedResource(session, profile.ownerId)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const tracks = await withDbRetry(() =>
    db.artistMediaAsset.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        hexId: true,
        title: true,
        notes: true,
        mimeType: true,
        fileSizeBytes: true,
        freeUseEnabled: true,
        createdAt: true
      }
    })
  );

  return NextResponse.json({ tracks });
}

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
    const requestedTitle = String(formData.get('title') ?? '').trim().slice(0, 200);
    const notesValue = String(formData.get('notes') ?? '').trim().slice(0, 1000);
    const freeUseEnabled = String(formData.get('freeUseEnabled') ?? '').toLowerCase() === 'true';
    const file = formData.get('file');

    if (!profileId) {
      return NextResponse.json({ error: 'Artist profile is required.' }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Choose an audio file to upload.' }, { status: 400 });
    }

    if (!file.type.startsWith('audio/')) {
      return NextResponse.json({ error: 'Only audio files are supported.' }, { status: 400 });
    }

    const mediaValidationError = validateArtistMediaUpload(file);
    if (mediaValidationError) {
      return NextResponse.json({ error: mediaValidationError }, { status: 400 });
    }

    if (file.size > MAX_AUDIO_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'Audio uploads are limited to 10MB.' }, { status: 400 });
    }

    // Magic byte validation — verify actual file content matches claimed audio type
    const headerBuffer = await file.slice(0, 12).arrayBuffer();
    if (!validateAudioMagicBytes(new Uint8Array(headerBuffer))) {
      return NextResponse.json({ error: 'File content does not match a supported audio format.' }, { status: 400 });
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

    if (!canManageOwnedResource(session, profile.ownerId)) {
      return NextResponse.json({ error: 'Only the artist who owns this page can upload media.' }, { status: 403 });
    }

    const title = (requestedTitle || deriveTitleFromFileName(file.name)).slice(0, 160);
    const hexId = createHexId();
    const hasBlobStorage = await isBlobMediaStorageAvailable();

    if (!hasBlobStorage && !(await areDatabaseMediaUploadsEnabledRuntime())) {
      return NextResponse.json(
        {
          error:
            'Media uploads require object storage before production use. Configure Cloudflare R2 or enable the temporary database storage flag.'
        },
        { status: 501 }
      );
    }

    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const durationSecs = parseAudioDuration(fileBytes) ?? null;

    const storedMedia = hasBlobStorage
      ? await uploadArtistMediaToBlob({ file, hexId, profileId: profile.id })
      : null;
    const fileDataBase64 = storedMedia ? null : Buffer.from(fileBytes).toString('base64');

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
              fileDataBase64,
              storageProvider: storedMedia?.provider ?? 'database',
              storageKey: storedMedia?.key ?? null,
              storageUrl: storedMedia?.url ?? null,
              freeUseEnabled,
              durationSecs,
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
              freeUseEnabled: true,
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
    return NextResponse.json({ error: 'Could not upload this media item.' }, { status: 500 });
  }
}
