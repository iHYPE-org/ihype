import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db, withDbRetry } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { log } from '@/lib/logger';
import { deleteArtistMediaFromBlob } from '@/lib/media-storage';
import { deleteMediaFile, isStoredMediaUrl } from '@/lib/object-storage';
import { albumRelease, isHeld, resolveRelease } from '@/lib/release-schedule';

/** Best-effort removal of a stored cover; a missing object is not an error. */
async function deleteStoredImage(url: string | null) {
  if (!url || !isStoredMediaUrl(url)) return;
  await deleteMediaFile(new URL(url).pathname.replace(/^\/cdn\//, '')).catch(() => undefined);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ hexId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  try {
    const { hexId } = await params;
    const body = await request.json().catch(() => ({}));

    const asset = await withDbRetry(() =>
      db.artistMediaAsset.findUnique({
        where: { hexId },
        select: { id: true, profileId: true, isPublished: true, publishAt: true, artworkUrl: true, profile: { select: { ownerId: true } } }
      })
    );

    if (!asset) {
      return NextResponse.json({ error: 'Track not found.' }, { status: 404 });
    }

    if (!canManageOwnedResource(session, asset.profile.ownerId)) {
      return NextResponse.json({ error: 'Only the artist who owns this track can edit it.' }, { status: 403 });
    }

    const data: Record<string, unknown> = {};
    if ('freeUseEnabled' in body) data.freeUseEnabled = Boolean(body.freeUseEnabled);
    if ('title' in body && typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim().slice(0, 200);
    if ('notes' in body) data.notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 5000) || null : null;
    /* Which album folder the track sits in; null takes it out. The album has
       to be the same artist's — an id is not a capability, and a track filed
       under another profile's album would show on their page. */
    const held = isHeld(asset);
    if ('albumId' in body) {
      if (body.albumId === null || body.albumId === '') {
        data.albumId = null;
      } else if (typeof body.albumId === 'string' && body.albumId.length <= 64) {
        const album = await withDbRetry(() => db.album.findUnique({ where: { id: body.albumId }, select: { profileId: true, releasedOn: true } }));
        if (!album || album.profileId !== asset.profileId) {
          return NextResponse.json({ error: 'That album is not on this profile.' }, { status: 400 });
        }
        data.albumId = body.albumId;
        // Filing into a dated folder takes the folder's date, unless a hold is on.
        const inherited = albumRelease(album.releasedOn);
        if (inherited && !held && !('release' in body)) Object.assign(data, inherited);
      }
    }
    /* Release: 'now' | ISO instant | null (= now). Never lifts a HOLD: a
       track the scan or a moderator withheld stays withheld whatever date the
       artist picks — the hold is cleared in the moderation queue, not here. */
    if ('release' in body) {
      if (held) {
        return NextResponse.json({ error: 'This track is held for review. It goes live when a reviewer clears it, not on a date you set.' }, { status: 409 });
      }
      const release = resolveRelease(typeof body.release === 'string' || body.release === null ? body.release : undefined);
      if (!release) return NextResponse.json({ error: 'Release date could not be read.' }, { status: 400 });
      Object.assign(data, release);
    }
    /* Only removal here — `artworkUrl: null`. A new cover comes through
       POST /api/artist-media/[hexId]/artwork, which vets and stores it. */
    if ('artworkUrl' in body && body.artworkUrl === null) {
      data.artworkUrl = null;
      await deleteStoredImage(asset.artworkUrl);
    }

    const updated = await withDbRetry(() =>
      db.artistMediaAsset.update({
        where: { id: asset.id },
        data,
        select: { hexId: true, title: true, notes: true, freeUseEnabled: true, albumId: true, artworkUrl: true, isPublished: true, publishAt: true }
      })
    );

    return NextResponse.json(updated);
  } catch (error) {
    log.error('[api/artist-media/[hexId]]', error instanceof Error ? error : { error: String(error) }, 'patch failed');
    return NextResponse.json({ error: 'Could not update track.' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ hexId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  try {
    const { hexId } = await params;

    const asset = await withDbRetry(() =>
      db.artistMediaAsset.findUnique({
        where: { hexId },
        select: {
          id: true,
          profileId: true,
          storageKey: true,
          artworkUrl: true,
          profile: {
            select: {
              ownerId: true,
              songUploadCount: true
            }
          }
        }
      })
    );

    if (!asset) {
      return NextResponse.json({ error: 'Media upload not found.' }, { status: 404 });
    }

    if (!canManageOwnedResource(session, asset.profile.ownerId)) {
      return NextResponse.json({ error: 'Only the artist who owns this page can remove media.' }, { status: 403 });
    }

    await withDbRetry(() => db.artistMediaAsset.delete({ where: { id: asset.id } }));
    /* The row is gone; now the bytes. Best effort, after the delete, so a
       storage hiccup cannot leave a track the artist removed still listed.
       Until 2026-09-02 neither the audio nor the cover was removed from R2. */
    if (asset.storageKey) await deleteArtistMediaFromBlob(asset.storageKey).catch(() => undefined);
    await deleteStoredImage(asset.artworkUrl);
    await withDbRetry(() =>
      db.profile.update({
        where: { id: asset.profileId },
        data: {
          songUploadCount: Math.max(asset.profile.songUploadCount - 1, 0)
        }
      })
    );

    return NextResponse.json({ deleted: true, hexId });
  } catch (error) {
    log.error('[api/artist-media/[hexId]]', error instanceof Error ? error : { error: String(error) }, 'delete failed');
    return NextResponse.json({ error: 'Could not remove this upload.' }, { status: 500 });
  }
}
