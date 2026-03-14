import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { profileAccentToneIds, profileBackdropToneIds, profileDesignPresetIds } from '@/lib/profile-design';

const schema = z.object({
  headline: z.string().trim().max(140).optional(),
  bio: z.string().trim().max(280).optional(),
  heroImage: z.string().trim().url().optional().or(z.literal('')),
  aboutContent: z.string().trim().max(5000).optional(),
  journalContent: z.string().trim().max(5000).optional(),
  mediaContent: z.string().trim().max(5000).optional(),
  tourContent: z.string().trim().max(5000).optional(),
  merchContent: z.string().trim().max(5000).optional(),
  requestContent: z.string().trim().max(5000).optional(),
  recommendContent: z.string().trim().max(5000).optional(),
  topFiveContent: z.string().trim().max(5000).optional(),
  addressLine1: z.string().trim().max(200).optional(),
  contactInfo: z.string().trim().max(200).optional(),
  hoursText: z.string().trim().max(200).optional(),
  hometown: z.string().trim().max(160).optional(),
  city: z.string().trim().max(120).optional(),
  stateRegion: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().max(32).optional(),
  country: z.string().trim().max(120).optional(),
  parkingDetails: z.string().trim().max(5000).optional(),
  stayRecommendations: z.string().trim().max(5000).optional(),
  upcomingContent: z.string().trim().max(5000).optional(),
  previousShowHighlights: z.string().trim().max(5000).optional(),
  verificationNotes: z.string().trim().max(5000).optional(),
  themePreset: z.enum(profileDesignPresetIds).optional(),
  themeAccentTone: z.enum(profileAccentToneIds).optional(),
  themeBackdropTone: z.enum(profileBackdropToneIds).optional(),
  fanShareEnabled: z.boolean().optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = schema.parse(await request.json());

    const profile = await db.profile.findUnique({
      where: { id },
      select: { id: true, ownerId: true }
    });

    if (!profile) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    if (!canManageOwnedResource(session, profile.ownerId)) {
      return NextResponse.json({ error: 'Only the page owner can edit this page' }, { status: 403 });
    }

    const updatedProfile = await db.profile.update({
      where: { id },
      data: {
        headline: body.headline || null,
        bio: body.bio || null,
        heroImage: body.heroImage || null,
        aboutContent: body.aboutContent || null,
        journalContent: body.journalContent || null,
        mediaContent: body.mediaContent || null,
        tourContent: body.tourContent || null,
        merchContent: body.merchContent || null,
        requestContent: body.requestContent || null,
        recommendContent: body.recommendContent || null,
        topFiveContent: body.topFiveContent || null,
        addressLine1: body.addressLine1 || null,
        contactInfo: body.contactInfo || null,
        hoursText: body.hoursText || null,
        hometown: body.hometown || null,
        city: body.city || null,
        stateRegion: body.stateRegion || null,
        postalCode: body.postalCode || null,
        country: body.country || null,
        parkingDetails: body.parkingDetails || null,
        stayRecommendations: body.stayRecommendations || null,
        upcomingContent: body.upcomingContent || null,
        previousShowHighlights: body.previousShowHighlights || null,
        verificationNotes: body.verificationNotes || null,
        verificationStatus: body.verificationNotes ? 'PENDING' : undefined,
        verificationSubmittedAt: body.verificationNotes ? new Date() : undefined,
        themePreset: body.themePreset ?? undefined,
        themeAccentTone: body.themeAccentTone ?? undefined,
        themeBackdropTone: body.themeBackdropTone ?? undefined,
        fanShareEnabled: body.fanShareEnabled ?? undefined
      }
    });

    return NextResponse.json(updatedProfile);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Could not update this page' }, { status: 500 });
  }
}
