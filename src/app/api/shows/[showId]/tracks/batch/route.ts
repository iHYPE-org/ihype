import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';

type RouteContext = { params: Promise<{ showId: string }> };

const batchSchema = z.object({
  tracks: z.array(
    z.object({
      position: z.number().int().min(0),
      title: z.string().trim().min(1).max(200),
      artistName: z.string().trim().max(200).optional(),
      mediaHexId: z.string().optional(),
      externalUrl: z.string().url().optional()
    })
  ).max(200)
});

/** PUT /api/shows/[showId]/tracks/batch — replace the full tracklist atomically */
export async function PUT(req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { showId } = await params;

  const show = await db.show.findUnique({
    where: { id: showId },
    select: { id: true, creatorId: true }
  });

  if (!show) {
    return NextResponse.json({ error: 'Show not found.' }, { status: 404 });
  }

  const canManage = show.creatorId === session.user.id || isAdminSession(session);
  if (!canManage) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  let body: z.infer<typeof batchSchema>;
  try {
    body = batchSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request.', detail: err }, { status: 400 });
  }

  // Resolve mediaHexId → internal ArtistMediaAsset.id for tracks that reference iHYPE uploads
  const hexIds = body.tracks.map((t) => t.mediaHexId).filter((h): h is string => Boolean(h));
  const assetMap = new Map<string, string>();

  if (hexIds.length > 0) {
    const assets = await db.artistMediaAsset.findMany({
      where: { hexId: { in: hexIds } },
      select: { id: true, hexId: true }
    });
    for (const asset of assets) {
      assetMap.set(asset.hexId, asset.id);
    }
  }

  const creates = body.tracks.map((t) => {
    const mediaAssetId = t.mediaHexId ? (assetMap.get(t.mediaHexId) ?? null) : null;
    // Tracks without a resolved asset use a placeholder URL so the row is valid
    const externalUrl = t.externalUrl ?? (mediaAssetId ? null : null);
    return {
      showId,
      position: t.position,
      title: t.title,
      artistName: t.artistName ?? null,
      mediaAssetId,
      externalUrl: externalUrl ?? null,
      durationSecs: null
    };
  }).filter((t) => t.mediaAssetId !== null || t.externalUrl !== null);

  await db.$transaction([
    db.radioShowTrack.deleteMany({ where: { showId } }),
    ...(creates.length > 0
      ? [db.radioShowTrack.createMany({ data: creates })]
      : [])
  ]);

  return NextResponse.json({ saved: creates.length });
}
