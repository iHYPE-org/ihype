import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { ProfileType } from '@prisma/client';
import { db } from '@/lib/db';
import { createHexId } from '@/lib/hex-id';
import { slugify } from '@/lib/utils';

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['FAN', 'ARTIST', 'DJ', 'VENUE']).default('FAN'),
  acceptedArtistUploadPolicy: z.boolean().optional().default(false)
});

function getProfileType(role: 'FAN' | 'ARTIST' | 'DJ' | 'VENUE'): ProfileType {
  if (role === 'ARTIST') return 'ARTIST';
  if (role === 'DJ') return 'DJ';
  if (role === 'VENUE') return 'VENUE';
  return 'LISTENER';
}

function getProfilePath(type: ProfileType, slug: string) {
  if (type === 'ARTIST') return `/artists/${slug}`;
  if (type === 'DJ') return `/promoters/${slug}`;
  if (type === 'VENUE') return `/venues/${slug}`;
  return `/listeners/${slug}`;
}

function getProfileCopy(type: ProfileType, name: string) {
  if (type === 'ARTIST') {
    return {
      headline: `${name} is shaping the next chapter.`,
      bio: 'Add your story, current focus, and favorite way to move a room.',
      aboutContent: 'Tell people who you are, what you make, and what drives your work.',
      journalContent: 'Share updates, studio notes, release thoughts, or behind-the-scenes moments.',
      mediaContent: 'Drop video links, press pull quotes, playlists, or embed-ready media notes here.',
      tourContent: 'List upcoming dates, routing plans, and travel notes for booking conversations.',
      merchContent: 'Point fans to limited drops, vinyl, bundles, or whatever your merch table is cooking.'
    };
  }

  if (type === 'DJ') {
    return {
      headline: `${name} is building the next room worth talking about.`,
      bio: 'Introduce your sound, your rooms, and how you like to move a crowd.',
      aboutContent: 'Tell artists and venues what kind of nights you build and what you are looking for next.',
      recommendContent: 'Use this section to talk about the artists, collaborators, and scenes you champion.'
    };
  }

  if (type === 'VENUE') {
    return {
      headline: `${name} is opening its doors to the next wave.`,
      bio: 'Describe the room, the neighborhood, and the kind of nights you want to host.',
      aboutContent: 'Tell artists and promoters what the venue feels like, what it supports, and who it is for.',
      requestContent: 'Set expectations for artist recommendations, booking notes, and how listeners should use this request tab.'
    };
  }

  return {
    headline: `${name} is curating a personal listening world.`,
    bio: 'Introduce yourself, the scenes you love, and what you are always looking for next.',
    aboutContent: 'Tell people what kind of listener you are and what sounds stay in rotation.',
    topFiveContent: 'List your current top 5 artists, records, or live moments here.'
  };
}

async function generateUniqueProfileHexId() {
  let hexId = createHexId();

  while (await db.profile.findUnique({ where: { hexId } })) {
    hexId = createHexId();
  }

  return hexId;
}

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());

    if ((body.role === 'ARTIST' || body.role === 'DJ') && !body.acceptedArtistUploadPolicy) {
      return NextResponse.json(
        { error: 'Artists and promoters must accept the iHYPE artist upload and limited use license policy.' },
        { status: 400 }
      );
    }

    const normalizedEmail = body.email.toLowerCase();
    const existing = await db.user.findUnique({ where: { email: normalizedEmail } });

    if (existing) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await db.user.create({
      data: {
        name: body.name,
        email: normalizedEmail,
        passwordHash,
        role: body.role
      }
    });

    const profileType = getProfileType(body.role);
    const hexId = await generateUniqueProfileHexId();
    const baseSlug = slugify(body.name);
    let slug = baseSlug || `profile-${user.id.slice(0, 6)}`;
    let suffix = 1;

    while (await db.profile.findUnique({ where: { slug } })) {
      slug = `${baseSlug || 'profile'}-${suffix}`;
      suffix += 1;
    }

    const profile = await db.profile.create({
      data: {
        slug,
        hexId,
        type: profileType,
        name: body.name,
        ownerId: user.id,
        ...getProfileCopy(profileType, body.name)
      }
    });

    return NextResponse.json({
      id: user.id,
      email: user.email,
      mfaRequired: false,
      profileHexId: profile.hexId,
      profileSlug: profile.slug,
      profilePath: getProfilePath(profile.type, profile.slug)
    });
  } catch {
    return NextResponse.json({ error: 'Invalid registration payload' }, { status: 400 });
  }
}
