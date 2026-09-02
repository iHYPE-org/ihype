import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db, withDbRetry } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { editorSchema } from '@/lib/profile-editor-schema';
import { statOptionsForRole } from '@/lib/profile-stats-catalog';
import { sanitizeStoredProfileLocation } from '@/lib/public-location';
import { isStoredMediaUrl } from '@/lib/object-storage';

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
  hometown: true,
  members: true,
  contactInfo: true,
  hoursText: true,
  parkingDetails: true,
  stayRecommendations: true,
  heroImage: true,
  avatarImage: true,
  logoImage: true,
  galleryImage: true,
  themePreset: true,
  themeAccentTone: true,
  themeBackdropTone: true,
  fanShareEnabled: true,
  discoverable: true,
  capacity: true,
  roomType: true,
  pinnedStats: true,
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

  return NextResponse.json({ profile: sanitizeStoredProfileLocation(profile) });
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

  let profile: { id: string; ownerId: string; type: string; heroImage: string | null; avatarImage: string | null; logoImage: string | null; galleryImage: string | null } | null;
  try {
    profile = await withDbRetry(() => db.profile.findUnique({
      where: { id: body.profileId },
      select: { id: true, ownerId: true, type: true, heroImage: true, avatarImage: true, logoImage: true, galleryImage: true }
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

  const privateLocation = sanitizeStoredProfileLocation({
    type: profile.type,
    addressLine1: emptyToNull(body.addressLine1),
    postalCode: emptyToNull(body.postalCode),
    city: emptyToNull(body.city),
    stateRegion: emptyToNull(body.stateRegion),
    country: emptyToNull(body.country),
  });
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
    addressLine1: privateLocation.addressLine1,
    city: privateLocation.city,
    stateRegion: privateLocation.stateRegion,
    postalCode: privateLocation.postalCode,
    country: privateLocation.country,
    hometown: emptyToNull(body.hometown),
    members: emptyToNull(body.members),
    contactInfo: emptyToNull(body.contactInfo),
    hoursText: emptyToNull(body.hoursText),
    parkingDetails: emptyToNull(body.parkingDetails),
    stayRecommendations: emptyToNull(body.stayRecommendations),
    heroImage: emptyToNull(body.heroImage),
    avatarImage: emptyToNull(body.avatarImage),
    logoImage: emptyToNull(body.logoImage),
    galleryImage: emptyToNull(body.galleryImage),
    themePreset: body.themePreset || undefined,
    themeAccentTone: emptyToNull(body.themeAccentTone),
    themeBackdropTone: emptyToNull(body.themeBackdropTone),
    fanShareEnabled: body.fanShareEnabled,
    discoverable: body.discoverable,
    capacity: body.capacity,
    roomType: emptyToNull(body.roomType),
    // Re-validated against the profile's actual type here (not just the
    // catalog) so a stale client can't pin a stat that doesn't apply to
    // this role — e.g. a Venue can't pin "Tickets Bought" (a fan-only stat).
    pinnedStats: body.pinnedStats
      ? body.pinnedStats.filter((key) => statOptionsForRole(profile!.type).some((s) => s.key === key)).slice(0, 4)
      : undefined,
  };

  /* An image URL the app did not store is refused (second security scan,
     2026-09-02). The four graphic fields accepted any string and render as
     `<img src>` on the profile, in search and in the deck under a CSP that
     allows `img-src https:`, so an owner could point their avatar at a host
     they control and log the address and referrer of every member who saw
     it. A value that is UNCHANGED from what is stored is allowed through, so
     a profile carrying a pre-CDN external image can still save its text. */
  for (const field of ['heroImage', 'avatarImage', 'logoImage', 'galleryImage'] as const) {
    const next = data[field];
    if (typeof next === 'string' && next !== profile[field] && !isStoredMediaUrl(next)) {
      return NextResponse.json({ error: `${field} must be an image uploaded through iHYPE.` }, { status: 400 });
    }
  }
  if (typeof data.merchUrl === 'string') {
    let merch: URL | null = null;
    try { merch = new URL(data.merchUrl); } catch { merch = null; }
    if (!merch || merch.protocol !== 'https:') {
      return NextResponse.json({ error: 'merchUrl must be an https link.' }, { status: 400 });
    }
  }

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
