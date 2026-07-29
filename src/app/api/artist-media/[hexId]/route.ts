import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db, withDbRetry } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { log } from '@/lib/logger';

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
        select: { id: true, profile: { select: { ownerId: true } } }
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

    const updated = await withDbRetry(() =>
      db.artistMediaAsset.update({
        where: { id: asset.id },
        data,
        select: { hexId: true, title: true, notes: true, freeUseEnabled: true }
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
