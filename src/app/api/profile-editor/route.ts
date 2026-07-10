import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db, withDbRetry } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { editorSchema } from '@/lib/profile-editor-schema';

export const dynamic = 'force-dynamic';

function emptyToNull(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return value.length ? value : null;
}

const EDITOR_FIELDS = {
  id: true,
  slug: true,
  type: true,
  ownerId: true,
  name: true,
  pressKitContent: true,
  headline: true,
  bio: true,
  aboutContent: true,
  topFiveContent: true,
  mediaContent: true,
  nowPlaying: true,
  links: true,
  merchUrl: true,
  merchContent: true,
  tourContent: true,
  requestContent: true,
  upcomingContent: true,
  previousShowHighlights: true,
  addressLine1: true,
  city: true,
  stateRegion: true,
  postalCode: true,
  country: true,
  hoursText: true,
  parkingDetails: true,
  stayRecommendations: true,
  heroImage: true,
  avatarImage: true,
  logoImage: true,
  galleryImage: true,
  featureVideoUrl: true,
  themePreset: true,
  themeAccentTone: true,
  themeBackdropTone: true,
  fanShareEnabled: true,
} as const;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get('profileId');
  if (!profileId) {
    return NextResponse.json({ error: 'profileId is required.' }, { status: 400 });
  }

  let profile;
  try {
    profile = await withDbRetry(() => db.profile.findUnique({ where: { id: profileId }, select: EDITOR_FIELDS }));
  } catch {
    return NextResponse.json({ error: 'Database unavailable — please try again in a moment.' }, { status: 503 });
  }

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  }

  if (!canManageOwnedResource(session, profile.ownerId)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  return NextResponse.json({ profile });
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

  let profile: { id: string; ownerId: string; type: string } | null;
  try {
    profile = await withDbRetry(() => db.profile.findUnique({
      where: { id: body.profileId },
      select: { id: true, ownerId: true, type: true }
    }));
  } catch {
    return NextResponse.json({ error: 'Database unavailable — please try again in a moment.' }, { status: 503 });
  }

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
    pressKitContent: emptyToNull(body.pressKitContent),
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

  let updated: { id: string; slug: string; type: string; updatedAt: Date };
  try {
    updated = await withDbRetry(() => db.profile.update({
      where: { id: profile!.id },
      data,
      select: { id: true, slug: true, type: true, updatedAt: true }
    }));
  } catch {
    return NextResponse.json({ error: 'Database unavailable — your changes could not be saved. Please try again.' }, { status: 503 });
  }

  return NextResponse.json({ ok: true, profile: updated });
}
