import { auth } from '@/lib/auth';
import { db, withDbRetry } from '@/lib/db';
import { serveMediaAsset } from '@/lib/media-response';
import { isMediaReleased } from '@/lib/media-release';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hexId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { hexId } = await params;
  const asset = await withDbRetry(() =>
    db.artistMediaAsset.findUnique({
      where: { hexId },
      select: {
        originalFileName: true,
        mimeType: true,
        fileDataBase64: true,
        storageUrl: true,
        isPublished: true,
        publishAt: true,
        profile: { select: { ownerId: true, discoverable: true } },
      },
    }),
  );
  const ownerCanPreview = asset?.profile.ownerId === session.user.id;
  if (!asset || (!ownerCanPreview && (!isMediaReleased(asset) || !asset.profile.discoverable))) {
    return Response.json({ error: 'Media not found.' }, { status: 404 });
  }

  return serveMediaAsset(request, asset, { cacheControl: 'private, no-store' });
}
