import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db, withDbRetry } from '@/lib/db';
import { createHexId } from '@/lib/hex-id';
import { validateArtistMediaUpload } from '@/lib/media-validation';
import { deleteArtistMediaFromBlob, isBlobMediaStorageAvailable, uploadArtistMediaToBlob } from '@/lib/media-storage';
import { canManageOwnedResource } from '@/lib/permissions';
import { areDatabaseMediaUploadsEnabledRuntime } from '@/lib/runtime-flags';
import { validateAudioMagicBytes } from '@/lib/validate-upload';
import { parseAudioDuration } from '@/lib/audio-duration';
import { vetFreeUseSample } from '@/lib/media-vetting';
import { recordAuditEvent } from '@/lib/audit';
import { consumeRateLimit, rateLimitKey } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

export const dynamic = 'force-dynamic';

const MAX_AUDIO_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_PROFILE_STORAGE_BYTES = 250 * 1024 * 1024;
const MAX_PROFILE_TRACKS = 100;

class MediaQuotaError extends Error {}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get('profileId')?.trim() ?? '';
  if (!profileId) return NextResponse.json({ error: 'profileId is required.' }, { status: 400 });

  const profile = await withDbRetry(() =>
    db.profile.findUnique({
      where: { id: profileId },
      select: { id: true, ownerId: true, type: true },
    }),
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
      take: MAX_PROFILE_TRACKS,
      select: {
        hexId: true,
        title: true,
        notes: true,
        mimeType: true,
        fileSizeBytes: true,
        freeUseEnabled: true,
        createdAt: true,
      },
    }),
  );

  return NextResponse.json({ tracks });
}

function deriveTitleFromFileName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 'Artist upload';
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

  const rateLimit = await consumeRateLimit(
    rateLimitKey('artist-media-upload', session.user.id, readClientAddress(request)),
    { limit: 20, windowMs: 60 * 60 * 1000 },
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many uploads. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
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

    const headerBuffer = await file.slice(0, 12).arrayBuffer();
    if (!validateAudioMagicBytes(new Uint8Array(headerBuffer))) {
      return NextResponse.json({ error: 'File content does not match a supported audio format.' }, { status: 400 });
    }

    const profile = await withDbRetry(() =>
      db.profile.findUnique({
        where: { id: profileId },
        select: { id: true, ownerId: true, type: true, name: true },
      }),
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
            'Media uploads require object storage before production use. Configure Cloudflare R2 or enable the temporary database storage flag.',
        },
        { status: 501 },
      );
    }

    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const durationSecs = parseAudioDuration(fileBytes) ?? null;

    let effectiveFreeUse = freeUseEnabled;
    let vetting: Awaited<ReturnType<typeof vetFreeUseSample>> | null = null;
    if (freeUseEnabled) {
      vetting = await vetFreeUseSample({
        title,
        notes: notesValue || null,
        fileName: file.name || '',
        artistName: profile.name,
        durationSecs,
      });
      effectiveFreeUse = vetting.cleared;
    }

    let reservedAssetId: string | null = null;
    let storedMedia: Awaited<ReturnType<typeof uploadArtistMediaToBlob>> | null = null;
    let asset: {
      hexId: string;
      title: string;
      notes: string | null;
      mimeType: string;
      fileSizeBytes: number;
      freeUseEnabled: boolean;
      createdAt: Date;
    };

    try {
      const reserved = await withDbRetry(() =>
        db.$transaction(async (tx) => {
          await tx.$queryRaw(
            Prisma.sql`SELECT "id" FROM "Profile" WHERE "id" = ${profile.id} FOR UPDATE`,
          );
          const usage = await tx.artistMediaAsset.aggregate({
            where: { profileId: profile.id },
            _count: { _all: true },
            _sum: { fileSizeBytes: true },
          });
          if (usage._count._all >= MAX_PROFILE_TRACKS) {
            throw new MediaQuotaError(
              `Each artist profile is limited to ${MAX_PROFILE_TRACKS} uploaded tracks.`,
            );
          }
          if ((usage._sum.fileSizeBytes ?? 0) + file.size > MAX_PROFILE_STORAGE_BYTES) {
            throw new MediaQuotaError(
              'This upload would exceed the 250MB storage limit for the artist profile.',
            );
          }

          await tx.profile.update({
            where: { id: profile.id },
            data: { songUploadCount: { increment: 1 } },
          });
          return tx.artistMediaAsset.create({
            data: {
              hexId,
              title,
              notes: notesValue || null,
              originalFileName: file.name || `${hexId}.audio`,
              mimeType: file.type,
              fileSizeBytes: file.size,
              storageProvider: 'pending',
              freeUseEnabled: effectiveFreeUse,
              durationSecs,
              profileId: profile.id,
              isPublished: false,
            },
            select: { id: true },
          });
        }),
      );
      reservedAssetId = reserved.id;

      storedMedia = hasBlobStorage
        ? await uploadArtistMediaToBlob({ file, hexId, profileId: profile.id })
        : null;
      const fileDataBase64 = storedMedia ? null : Buffer.from(fileBytes).toString('base64');

      asset = await withDbRetry(() =>
        db.artistMediaAsset.update({
          where: { id: reserved.id },
          data: {
            fileDataBase64,
            storageProvider: storedMedia?.provider ?? 'database',
            storageKey: storedMedia?.key ?? null,
            storageUrl: storedMedia?.url ?? null,
            isPublished: true,
          },
          select: {
            hexId: true,
            title: true,
            notes: true,
            mimeType: true,
            fileSizeBytes: true,
            freeUseEnabled: true,
            createdAt: true,
          },
        }),
      );
    } catch (error) {
      if (storedMedia?.key) {
        await deleteArtistMediaFromBlob(storedMedia.key).catch((cleanupError) => {
          console.error('[artist-media] failed to remove orphaned R2 object', cleanupError);
        });
      }
      if (reservedAssetId) {
        await db.$transaction(async (tx) => {
          const deleted = await tx.artistMediaAsset.deleteMany({
            where: { id: reservedAssetId!, isPublished: false },
          });
          if (deleted.count === 1) {
            await tx.profile.updateMany({
              where: { id: profile.id, songUploadCount: { gt: 0 } },
              data: { songUploadCount: { decrement: 1 } },
            });
          }
        }).catch((cleanupError) => {
          console.error('[artist-media] failed to release upload reservation', cleanupError);
        });
      }
      throw error;
    }

    if (vetting) {
      await recordAuditEvent({
        actorUserId: session.user.id,
        action: vetting.cleared ? 'media.free_use.auto_cleared' : 'media.free_use.auto_flagged',
        entityType: 'ArtistMediaAsset',
        entityId: hexId,
        metadata: {
          reasoning: vetting.reasoning,
          requiresManualReview: vetting.requiresManualReview,
        },
      }).catch(() => {});
    }

    return NextResponse.json({
      asset: {
        ...asset,
        url: `/api/media/${asset.hexId}`,
        shareUrl: `/api/media/${asset.hexId}`,
      },
      ...(vetting && !vetting.cleared
        ? {
            vetting: {
              freeUseWithheld: true,
              reasoning: vetting.reasoning,
              message:
                'Uploaded, but automated vetting kept it out of the shared free-use radio crate. It stays available on your own page.',
            },
          }
        : {}),
    });
  } catch (error) {
    if (error instanceof MediaQuotaError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    console.error('Artist media upload failed', error);
    return NextResponse.json({ error: 'Could not upload this media item.' }, { status: 500 });
  }
}
