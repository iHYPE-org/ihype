import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client/edge';
import { auth } from '@/lib/auth';
import { db, withDbRetry } from '@/lib/db';
import { createHexId } from '@/lib/hex-id';
import { validateArtistMediaUpload } from '@/lib/media-validation';
import { deleteArtistMediaFromBlob, isBlobMediaStorageAvailable, uploadArtistMediaToBlob } from '@/lib/media-storage';
import { canManageOwnedResource } from '@/lib/permissions';
import { areDatabaseMediaUploadsEnabledRuntime, areUploadsEnabledRuntime } from '@/lib/runtime-flags';
import { AUDIO_SNIFF_BYTES, PLAYABLE_AUDIO_FORMATS_LABEL, sniffAudio } from '@/lib/validate-upload';
import { parseAudioDuration } from '@/lib/audio-duration';
import { runTrackScanPipeline } from '@/lib/media-vetting';
import { albumRelease, resolveRelease } from '@/lib/release-schedule';
import { isObjectStorageConfigured, storeMediaFile } from '@/lib/object-storage';
import { vetImageUpload } from '@/lib/image-vetting';
import { recordAuditEvent } from '@/lib/audit';
import { consumeRateLimit, rateLimitKey } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { log } from '@/lib/logger';
import { exceedsDeclaredRequestSize } from '@/lib/request-size';

export const dynamic = 'force-dynamic';

/* Sized for lossless (owner, 2026-09-02: any format we can play). A 16-bit
   44.1 kHz stereo WAV is ~10 MB a minute and FLAC about half that, so the old
   10 MB cap admitted a one-minute WAV and nothing longer; 60 MB is a six-minute
   WAV or a twelve-minute FLAC. The ceiling is the WORKER, not taste: this route
   reads the whole file into memory (`file.arrayBuffer()`) to sniff, measure and
   scan it, the isolate has 128 MB, and the request is buffered by `formData()`
   too — so the request cap sits a little above the file cap and both stay well
   under half the heap. Going past this means streaming the body to R2 and
   scanning only its head, which is a different route. */
const MAX_AUDIO_FILE_SIZE_BYTES = 60 * 1024 * 1024;
const MAX_ARTWORK_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const ARTWORK_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
/* 1 GB a profile: roughly a hundred lossless tracks, which is also the track
   ceiling below. Raised from 250 MB with the file cap for the same reason. */
const MAX_PROFILE_STORAGE_BYTES = 1024 * 1024 * 1024;
const MAX_PROFILE_TRACKS = 100;
const MAX_UPLOAD_REQUEST_SIZE_BYTES = 70 * 1024 * 1024;

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

  if (!profile || !['ARTIST'].includes(profile.type)) {
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
        artworkUrl: true,
        albumId: true,
        isPublished: true,
        publishAt: true,
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

function validateArtworkMagicBytes(buf: Uint8Array, mime: string): boolean {
  if (buf.length < 4) return false;
  if (mime === 'image/jpeg') return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (mime === 'image/png') return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (mime === 'image/gif') return buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46;
  if (mime === 'image/webp') return buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
  return false;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  if (!(await areUploadsEnabledRuntime())) {
    return NextResponse.json(
      { error: 'Media uploads are temporarily paused. Existing music remains available.' },
      { status: 503, headers: { 'Retry-After': '900' } },
    );
  }

  // Reject declared oversized bodies before request.formData() can buffer
  // them. Edge/WAF limits remain necessary for chunked or dishonest clients.
  if (exceedsDeclaredRequestSize(request, MAX_UPLOAD_REQUEST_SIZE_BYTES)) {
    return NextResponse.json({ error: 'Upload request is limited to 70MB.' }, { status: 413 });
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
    /* Release: absent/'now' launches the moment the scan clears; an ISO instant
       in the future schedules it (the publish-scheduled cron flips it live and
       tells the artist). An album id files the track into a folder, and a
       folder with a future date sets the track's date when none was given. */
    const releaseInput = formData.get('publishAt');
    const release = resolveRelease(typeof releaseInput === 'string' ? releaseInput : undefined);
    if (!release) {
      return NextResponse.json({ error: 'Release date could not be read.' }, { status: 400 });
    }
    const albumIdInput = String(formData.get('albumId') ?? '').trim().slice(0, 64) || null;
    const file = formData.get('file');
    const artworkFile = formData.get('artwork');

    if (!profileId) {
      return NextResponse.json({ error: 'Artist profile is required.' }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Choose an audio file to upload.' }, { status: 400 });
    }
    if (!file.type.startsWith('audio/')) {
      return NextResponse.json({ error: 'Only audio files are supported.' }, { status: 400 });
    }
    if (artworkFile instanceof File) {
      if (!ARTWORK_ALLOWED_TYPES.includes(artworkFile.type)) {
        return NextResponse.json({ error: 'Cover art must be JPEG, PNG, GIF, or WebP.' }, { status: 400 });
      }
      if (artworkFile.size > MAX_ARTWORK_FILE_SIZE_BYTES) {
        return NextResponse.json({ error: 'Cover art is limited to 8MB.' }, { status: 400 });
      }
    }

    const mediaValidationError = validateArtistMediaUpload(file);
    if (mediaValidationError) {
      return NextResponse.json({ error: mediaValidationError }, { status: 400 });
    }
    if (file.size > MAX_AUDIO_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'Audio uploads are limited to 60MB. For a longer piece, upload it as FLAC or AAC/M4A.' }, { status: 400 });
    }

    /* The head of the file, not its name or MIME type, decides what it is.
       Anything the platform's players cannot all decode is refused with the
       reason (validate-upload.ts); a video track is refused whatever the
       container claims. */
    const headerBuffer = await file.slice(0, AUDIO_SNIFF_BYTES).arrayBuffer();
    const sniff = sniffAudio(new Uint8Array(headerBuffer));
    if (!sniff) {
      return NextResponse.json({ error: `File content does not match a supported audio format. Upload ${PLAYABLE_AUDIO_FORMATS_LABEL}.` }, { status: 400 });
    }
    if (!sniff.playable) {
      return NextResponse.json({ error: sniff.reason ?? `Upload ${PLAYABLE_AUDIO_FORMATS_LABEL}.` }, { status: 400 });
    }

    const profile = await withDbRetry(() =>
      db.profile.findUnique({
        where: { id: profileId },
        select: { id: true, ownerId: true, type: true, name: true, verificationStatus: true },
      }),
    );

    if (!profile || !['ARTIST'].includes(profile.type)) {
      return NextResponse.json({ error: 'Artist or DJ profile not found.' }, { status: 404 });
    }
    if (!canManageOwnedResource(session, profile.ownerId)) {
      return NextResponse.json({ error: 'Only the profile owner can upload media.' }, { status: 403 });
    }

    // Uploading requires having submitted identity evidence. Not full
    // verification — waiting out a 48-hour human review before you can put a
    // single track up would strand every new artist — but an account that has
    // never told us who it is does not get to publish recordings under a name
    // it merely claimed. UNVERIFIED is exactly that state now that
    // registration no longer stamps PENDING at signup.
    if (profile.verificationStatus === 'UNVERIFIED' || profile.verificationStatus === 'REJECTED') {
      return NextResponse.json(
        {
          error:
            profile.verificationStatus === 'REJECTED'
              ? 'This page could not be verified. Contact admin@ihype.org before uploading.'
              : 'Verify this page before uploading. It takes a link or a document.',
          verificationRequired: true,
        },
        { status: 403 },
      );
    }

    let album: { id: string; releasedOn: Date | null } | null = null;
    if (albumIdInput) {
      album = await withDbRetry(() => db.album.findFirst({ where: { id: albumIdInput, profileId: profile.id }, select: { id: true, releasedOn: true } }));
      if (!album) return NextResponse.json({ error: 'That album is not on this profile.' }, { status: 400 });
    }
    const effectiveRelease = (typeof releaseInput === 'string' && releaseInput !== '' && releaseInput !== 'now')
      ? release
      : (album ? albumRelease(album.releasedOn) ?? release : release);

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

    // Every upload runs the full 4-layer scan pipeline (ID3 tag check,
    // acoustic fingerprinting, feature/motif matching, vocal/synth AI
    // analysis — see src/lib/media-vetting.ts's runTrackScanPipeline).
    // Previously only metadata + lyric checks ran, and only for
    // freeUseEnabled uploads; now every upload (Artist or DJ) is scanned.
    // Layers 1 & 2 are honestly unconfigured (no fingerprinting service
    // exists in this codebase) and never block a track — only layers 0
    // and 3 can.
    //
    // No longer fail-open at the publish step. A flagged track used to go
    // live immediately and merely raise a ContentReport, so the window
    // between "our own scan says this may be someone else's recording" and a
    // human looking at it was a window in which it was playable by everyone.
    // For a platform whose licensing story is the product, that is the wrong
    // default. A flag now holds the track unpublished until /admin/moderation
    // clears it. The scan still fails OPEN in the other direction: if a layer
    // errors or is unconfigured it does not flag, so an outage cannot silently
    // freeze every upload.
    const scan = await runTrackScanPipeline(fileBytes, {
      title,
      notes: notesValue || null,
      fileName: file.name || '',
      artistName: profile.name,
      durationSecs,
    });
    const vetting = { cleared: scan.cleared, requiresManualReview: scan.requiresManualReview, reasoning: scan.reasoning };
    const effectiveFreeUse = freeUseEnabled && vetting.cleared;

    // Optional cover art — same magic-byte + AI-vetting + storage pattern
    // already used for profile graphics (src/app/api/profile/upload-graphic
    // /route.ts), reused here rather than reinvented. Purely additive: a
    // flagged or missing image never blocks the track upload itself.
    let artworkUrl: string | null = null;
    if (artworkFile instanceof File) {
      const artworkBytes = new Uint8Array(await artworkFile.arrayBuffer());
      if (!validateArtworkMagicBytes(artworkBytes, artworkFile.type)) {
        return NextResponse.json({ error: 'Cover art file content does not match its declared type.' }, { status: 400 });
      }
      const artworkVetting = await vetImageUpload(artworkBytes, 'track cover art');
      if (!artworkVetting.cleared) {
        await db.contentReport.create({
          data: {
            targetType: 'track-artwork',
            targetId: hexId,
            reason: 'auto_flag_image',
            details: artworkVetting.reasoning,
          },
        }).catch(() => {});
      } else {
        const base64 = Buffer.from(artworkBytes).toString('base64');
        const dataUrl = `data:${artworkFile.type};base64,${base64}`;
        if (isObjectStorageConfigured()) {
          const ext = artworkFile.type.split('/')[1] ?? 'bin';
          const key = `artist-media/${profile.id}/artwork/${hexId}.${ext}`;
          const stored = await storeMediaFile(key, dataUrl, artworkFile.type);
          artworkUrl = stored.url;
        } else {
          artworkUrl = dataUrl;
        }
      }
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
      artworkUrl: string | null;
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
              artworkUrl,
              profileId: profile.id,
              albumId: album?.id ?? null,
              publishAt: effectiveRelease.publishAt,
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
            /* Live only if the scan cleared it AND the artist said "now". A
               scheduled track stays unpublished with its date set; the
               publish-scheduled cron flips it on and tells the artist. */
            isPublished: vetting.cleared && effectiveRelease.isPublished,
          },
          select: {
            hexId: true,
            title: true,
            notes: true,
            mimeType: true,
            fileSizeBytes: true,
            freeUseEnabled: true,
            artworkUrl: true,
            createdAt: true,
          },
        }),
      );
    } catch (error) {
      if (storedMedia?.key) {
        await deleteArtistMediaFromBlob(storedMedia.key).catch((cleanupError) => {
          log.error('[artist-media]', cleanupError instanceof Error ? cleanupError : { error: String(cleanupError) }, 'failed to remove orphaned R2 object');
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
          log.error('[artist-media]', cleanupError instanceof Error ? cleanupError : { error: String(cleanupError) }, 'failed to release upload reservation');
        });
      }
      throw error;
    }

    await recordAuditEvent({
      actorUserId: session.user.id,
      action: vetting.cleared ? 'media.upload.auto_cleared' : 'media.upload.auto_flagged',
      entityType: 'ArtistMediaAsset',
      entityId: hexId,
      metadata: {
        reasoning: vetting.reasoning,
        requiresManualReview: vetting.requiresManualReview,
        freeUseRequested: freeUseEnabled,
      },
    }).catch(() => {});

    // A flag holds the track: it is stored and owned by the uploader, but
    // isPublished stays false until a human clears it in the existing admin
    // moderation queue (/admin/moderation?type=track). The ContentReport
    // below is what puts it in front of that human.
    //
    // The cost is a legitimate artist waiting on a false positive, which is
    // why the scan itself still fails open — an unconfigured or erroring
    // layer never flags, so only a positive identification holds anything.
    if (!vetting.cleared) {
      await db.contentReport.create({
        data: {
          targetType: 'track',
          targetId: hexId,
          reason: vetting.requiresManualReview ? 'auto_flag_ambiguous' : 'auto_flag_copyright',
          details: vetting.reasoning,
        },
      }).catch(() => {});
    }

    return NextResponse.json({
      asset: {
        ...asset,
        url: `/api/media/${asset.hexId}`,
        shareUrl: `/api/media/${asset.hexId}`,
      },
      scan: scan.layers,
      published: vetting.cleared,
      ...(!vetting.cleared
        ? {
            vetting: {
              freeUseWithheld: freeUseEnabled,
              held: true,
              reasoning: vetting.reasoning,
              // Says held, because it is held. The previous copy told the
              // uploader the track "stays live while that review happens",
              // which was true then and is not now — a flagged track is
              // stored but unpublished until a human clears it.
              message:
                'Uploaded and held. Our scan flagged this track, so it stays off your page until someone reviews it — usually within 48 hours.',
            },
          }
        : {}),
    });
  } catch (error) {
    if (error instanceof MediaQuotaError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    log.error('[api/artist-media]', error instanceof Error ? error : { error: String(error) }, 'upload failed');
    return NextResponse.json({ error: 'Could not upload this media item.' }, { status: 500 });
  }
}
