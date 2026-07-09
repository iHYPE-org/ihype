import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { serveMediaAsset } from '@/lib/media-response';
import { parseShowProductionPlan } from '@/lib/show-composer';
import { canViewerAccessShowMedia } from '@/lib/show-media-access';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ showId: string; hexId: string }> },
) {
  const { showId, hexId } = await params;
  const show = await db.show.findUnique({
    where: { id: showId },
    select: {
      id: true,
      isTicketed: true,
      creatorId: true,
      productionPlan: true,
    },
  });
  if (!show) return Response.json({ error: 'Show not found.' }, { status: 404 });

  const session = await auth().catch(() => null);
  const allowed = await canViewerAccessShowMedia({
    showId: show.id,
    isTicketed: show.isTicketed,
    creatorId: show.creatorId,
    userId: session?.user?.id,
    role: session?.user?.role,
    email: session?.user?.email,
  });
  if (!allowed) {
    return Response.json(
      { error: session?.user?.id ? 'A captured ticket is required.' : 'Login and a captured ticket are required.' },
      { status: session?.user?.id ? 403 : 401 },
    );
  }

  const productionPlan = parseShowProductionPlan(show.productionPlan);
  if (!productionPlan?.mediaItems.some((item) => item.mediaId === hexId)) {
    return Response.json({ error: 'Media is not part of this show.' }, { status: 404 });
  }

  const asset = await db.artistMediaAsset.findFirst({
    where: { hexId, isPublished: true },
    select: {
      originalFileName: true,
      mimeType: true,
      fileDataBase64: true,
      storageUrl: true,
    },
  });
  if (!asset) return Response.json({ error: 'Media not found.' }, { status: 404 });

  return serveMediaAsset(request, asset, { cacheControl: 'private, no-store' });
}
