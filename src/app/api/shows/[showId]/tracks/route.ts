import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';

type RouteContext = { params: Promise<{ showId: string }> };

async function resolveShow(showId: string) {
  return db.show.findUnique({
    where: { id: showId },
    select: { id: true, isRadioShow: true, creatorId: true }
  });
}

function canManage(session: Session | null, show: { creatorId: string }) {
  if (!session?.user?.id) return false;
  return session.user.id === show.creatorId || isAdminSession(session);
}

/** GET /api/shows/[showId]/tracks — public tracklist */
export async function GET(_req: Request, { params }: RouteContext) {
  const { showId } = await params;
  const tracks = await db.radioShowTrack.findMany({
    where: { showId },
    orderBy: { position: 'asc' },
    select: {
      id: true,
      position: true,
      title: true,
      artistName: true,
      externalUrl: true,
      durationSecs: true,
      blockLabel: true,
      mediaAsset: {
        select: { hexId: true, mimeType: true }
      }
    }
  });
  return NextResponse.json(tracks);
}

const trackSchema = z.object({
  position: z.number().int().min(0),
  title: z.string().trim().min(1).max(200),
  artistName: z.string().trim().max(200).optional(),
  mediaAssetId: z.string().optional(),
  externalUrl: z.string().url().optional(),
  durationSecs: z.number().int().positive().optional(),
  blockLabel: z.string().trim().max(100).optional()
}).refine(
  (d) => d.mediaAssetId || d.externalUrl,
  { message: 'Either mediaAssetId or externalUrl is required.' }
);

/** POST /api/shows/[showId]/tracks — append or upsert a track by position */
export async function POST(req: Request, { params }: RouteContext) {
  const session = await auth();
  const { showId } = await params;

  const show = await resolveShow(showId);
  if (!show) return NextResponse.json({ error: 'Show not found.' }, { status: 404 });
  if (!show.isRadioShow) return NextResponse.json({ error: 'Not a radio show.' }, { status: 409 });
  if (!canManage(session, show)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  let body: z.infer<typeof trackSchema>;
  try {
    body = trackSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request.', detail: err }, { status: 400 });
  }

  const track = await db.radioShowTrack.upsert({
    where: { showId_position: { showId, position: body.position } },
    create: { showId, ...body },
    update: {
      title: body.title,
      artistName: body.artistName ?? null,
      mediaAssetId: body.mediaAssetId ?? null,
      externalUrl: body.externalUrl ?? null,
      durationSecs: body.durationSecs ?? null,
      blockLabel: body.blockLabel ?? null
    }
  });

  return NextResponse.json(track, { status: 201 });
}

/** DELETE /api/shows/[showId]/tracks?position=N — remove a track slot */
export async function DELETE(req: Request, { params }: RouteContext) {
  const session = await auth();
  const { showId } = await params;

  const show = await resolveShow(showId);
  if (!show) return NextResponse.json({ error: 'Show not found.' }, { status: 404 });
  if (!canManage(session, show)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const url = new URL(req.url);
  const position = parseInt(url.searchParams.get('position') ?? '', 10);
  if (isNaN(position)) {
    return NextResponse.json({ error: 'position query param required.' }, { status: 400 });
  }

  await db.radioShowTrack.deleteMany({ where: { showId, position } });
  return NextResponse.json({ ok: true });
}
