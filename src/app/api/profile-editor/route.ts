import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const text = (max = 5000) => z.string().trim().max(max).optional();
const urlText = z.string().trim().max(2048).optional();

const editorSchema = z.object({
  profileId: z.string().cuid(),
  name: text(120),
  headline: text(180),
  bio: text(1000),
  aboutContent: text(5000),
  topFiveContent: text(2000),
  mediaContent: text(5000),
  nowPlaying: text(240),
  links: text(5000),
  merchUrl: urlText,
  merchContent: text(5000),
  tourContent: text(5000),
  requestContent: text(5000),
  upcomingContent: text(5000),
  previousShowHighlights: text(5000),
  addressLine1: text(240),
  city: text(120),
  stateRegion: text(120),
  postalCode: text(40),
  country: text(80),
  hoursText: text(500),
  parkingDetails: text(1000),
  stayRecommendations: text(1000),
  heroImage: urlText,
  avatarImage: urlText,
  logoImage: urlText,
  galleryImage: urlText,
  featureVideoUrl: urlText,
  themePreset: text(80),
  themeAccentTone: text(80),
  themeBackdropTone: text(80),
  fanShareEnabled: z.boolean().optional()
});

function emptyToNull(value: string | undefined) {
  if (value === undefined) return undefined;
  return value.length ? value : null;
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  }

  let body: z.infer<typeof editorSchema>;
  try {
    body = editorSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid page editor payload.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const profile = await db.profile.findUnique({
    where: { id: body.profileId },
    select: { id: true, ownerId: true, type: true }
  });

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  }

  if (!canManageOwnedResource(session, profile.ownerId)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const data = {
    name: body.name || undefined,
    headline: emptyToNull(body.headline),
    bio: emptyToNull(body.bio),
    aboutContent: emptyToNull(body.aboutContent),
    topFiveContent: emptyToNull(body.topFiveContent),
    mediaContent: emptyToNull(body.mediaContent),
    nowPlaying: emptyToNull(body.nowPlaying),
    links: emptyToNull(body.links),
    merchUrl: emptyToNull(body.merchUrl),
    merchContent: emptyToNull(body.merchContent),
    tourContent: emptyToNull(body.tourContent),
    requestContent: emptyToNull(body.requestContent),
    upcomingContent: emptyToNull(body.upcomingContent),
    previousShowHighlights: emptyToNull(body.previousShowHighlights),
    addressLine1: emptyToNull(body.addressLine1),
    city: emptyToNull(body.city),
    stateRegion: emptyToNull(body.stateRegion),
    postalCode: emptyToNull(body.postalCode),
    country: emptyToNull(body.country),
    hoursText: emptyToNull(body.hoursText),
    parkingDetails: emptyToNull(body.parkingDetails),
    stayRecommendations: emptyToNull(body.stayRecommendations),
    heroImage: emptyToNull(body.heroImage),
    avatarImage: emptyToNull(body.avatarImage),
    logoImage: emptyToNull(body.logoImage),
    galleryImage: emptyToNull(body.galleryImage),
    featureVideoUrl: emptyToNull(body.featureVideoUrl),
    themePreset: body.themePreset || undefined,
    themeAccentTone: emptyToNull(body.themeAccentTone),
    themeBackdropTone: emptyToNull(body.themeBackdropTone),
    fanShareEnabled: body.fanShareEnabled
  };

  const updated = await db.profile.update({
    where: { id: profile.id },
    data,
    select: { id: true, slug: true, type: true, updatedAt: true }
  });

  return NextResponse.json({ ok: true, profile: updated });
}
