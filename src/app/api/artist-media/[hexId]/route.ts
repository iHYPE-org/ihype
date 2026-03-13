import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db, withDbRetry } from '@/lib/db';

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

    if (asset.profile.ownerId !== session.user.id) {
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
    console.error('Artist media delete failed', error);
    return NextResponse.json({ error: 'Could not remove this upload.' }, { status: 500 });
  }
}
