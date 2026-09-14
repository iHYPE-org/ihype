import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { awardHype } from '@/lib/hype-ledger';
import { consumeRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/rate-limit';
import { releasedMediaWhere } from '@/lib/media-release';

const schema = z.object({
  mediaId: z.string().min(1).max(128),
  title: z.string().min(1).max(200),
  /* A PATH, not necessarily a URL. The deck plays `/api/media/<hexId>` and a
     playlist saved from it stores that same relative path, so `.url()` here
     refused every completion from either with a 400 that read as a bad
     payload (row 436). The route prefers the asset's own `storageUrl` and
     only falls back to this, so it need only be present. */
  mediaUrl: z.string().min(1).max(2048),
  artistName: z.string().min(1).max(160),
  artistProfileSlug: z.string().min(1).max(160).optional()
});

/**
 * GET /api/media-listens → { recents } — the caller's recently played tracks,
 * most recent completion first.
 *
 * `MediaListen` keeps ONE row per (user, track) and the completion upsert
 * below stamps `completedAt` on every finish, so `completedAt desc` is the
 * real recency order and `createdAt` is only "first heard". The row is
 * denormalized (title, artist, url) but carries no artwork, so the cover is
 * hydrated from the asset in one batched query. `mediaId` IS the hexId — the
 * name `/app/tracks/[hexId]`, the player's queue and every listen counter
 * (`profile-insights`, `profile-stat-board`, the artist analytics page, the
 * track page) address a track by; see the POST for why that has to be said.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }
  try {
    const listens = await db.mediaListen.findMany({
      where: { userId: session.user.id, completedAt: { not: null } },
      orderBy: { completedAt: 'desc' },
      take: 12,
      select: { mediaId: true, title: true, mediaUrl: true, artistName: true, artistProfileSlug: true, completedAt: true },
    });
    const assets = listens.length
      ? await db.artistMediaAsset.findMany({
          where: { hexId: { in: listens.map((row) => row.mediaId) } },
          select: { hexId: true, artworkUrl: true },
        })
      : [];
    const assetByHexId = new Map(assets.map((asset) => [asset.hexId, asset]));
    const recents = listens.map((row) => ({
      id: row.mediaId,
      hexId: row.mediaId,
      title: row.title,
      artistName: row.artistName,
      artistSlug: row.artistProfileSlug,
      mediaUrl: row.mediaUrl,
      artworkUrl: assetByHexId.get(row.mediaId)?.artworkUrl ?? null,
    }));
    return NextResponse.json({ recents });
  } catch (err) {
    log.error('[media-listens] read failed', err instanceof Error ? err : { error: String(err) });
    return NextResponse.json({ error: 'Could not read listens' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  try {
    const rateLimit = await consumeRateLimit(
      rateLimitKey('media-listen', session.user.id, request.headers.get('x-forwarded-for')),
      { limit: 40, windowMs: 60 * 60 * 1000 },
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many listen completions.' },
        { status: 429, headers: rateLimitHeaders(rateLimit) },
      );
    }
    const payload = schema.parse(await request.json());
    /* By row id OR hexId. The player's queue addresses a track by hexId
       (`toQueue`: "the rest of the app addresses a track by it") and posts
       that as `mediaId`; this route looked the row up by `id`, a cuid, so a
       hexId could never match and every completion the REAL player ever sent
       answered 404 — no MediaListen, no recents rail, no TRACK_COMPLETED HYPE.
       The walk's items 10/11 and H1 passed throughout because they post the
       row id directly. Measured on the built worker, 2026-09-14 (DESIGN_SYNC
       row 436).

       And the row is STORED under the hexId, whichever name arrived. It used
       to be stored under `media.id`, while every reader — the public artist
       card's counters (`profile-insights`), the stats board's Listens and
       Completed listens tiles, the artist analytics page, the track page's
       play count — filters `mediaId IN (hexIds)`: so even the walk's own
       listens were counted by nothing a member reads. The migration
       `20260914120000_media_listen_media_id_hex` moves the rows already
       stored. The ledger key below stays on `media.id`: it is internal, and
       renaming it would award a second HYPE for a track already rewarded. */
    const media = await db.artistMediaAsset.findFirst({
      // AND, not a spread: `releasedMediaWhere()` carries its own OR (publishAt
      // null or past), and a spread would let one OR silently replace the other.
      where: { AND: [{ OR: [{ id: payload.mediaId }, { hexId: payload.mediaId }] }, releasedMediaWhere()] },
      select: {
        id: true,
        hexId: true,
        title: true,
        storageUrl: true,
        profile: { select: { name: true, slug: true, discoverable: true } },
      },
    });
    if (!media?.profile.discoverable) {
      return NextResponse.json({ error: 'Published media not found' }, { status: 404 });
    }

    await db.mediaListen.upsert({
      where: {
        userId_mediaId: {
          userId: session.user.id,
          // The hexId, not whatever name the caller used: one listen per
          // member per track, however the track was addressed.
          mediaId: media.hexId
        }
      },
      update: {
        title: media.title,
        mediaUrl: media.storageUrl ?? payload.mediaUrl,
        artistName: media.profile.name,
        artistProfileSlug: media.profile.slug,
        completedAt: new Date()
      },
      create: {
        userId: session.user.id,
        mediaId: media.hexId,
        title: media.title,
        mediaUrl: media.storageUrl ?? payload.mediaUrl,
        artistName: media.profile.name,
        artistProfileSlug: media.profile.slug,
        completedAt: new Date()
      }
    });

    const reward = await awardHype({
      userId: session.user.id,
      amount: 1,
      source: 'TRACK_COMPLETED',
      idempotencyKey: `track-completed:${session.user.id}:${media.id}`,
      targetType: 'track',
      targetId: media.id,
      dailyLimit: 20,
    });

    return NextResponse.json({
      recorded: true,
      hypeAwarded: reward.applied ? reward.entry?.amount ?? 0 : 0,
      hypeBalance: reward.entry?.balanceAfter,
    });
  } catch (err) {
    log.error('[media-listens]', err instanceof Error ? err : { error: String(err) });
    return NextResponse.json({ error: 'Invalid media listen payload' }, { status: 400 });
  }
}
