import { db } from '@/lib/db';
import { serveMediaAsset } from '@/lib/media-response';
import { releasedMediaWhere } from '@/lib/media-release';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hexId: string }> },
) {
  const { hexId } = await params;
  const asset = await db.artistMediaAsset.findFirst({
    where: { hexId, ...releasedMediaWhere() },
    select: {
      originalFileName: true,
      mimeType: true,
      fileDataBase64: true,
      storageUrl: true,
    },
  });
  if (!asset) return Response.json({ error: 'Media not found.' }, { status: 404 });

  return serveMediaAsset(request, asset, {
    cacheControl: 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
  });
}
