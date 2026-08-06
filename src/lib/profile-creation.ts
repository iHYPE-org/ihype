import { ProfileType } from '@prisma/client/edge';
import { db } from '@/lib/db';
import { createHexId } from '@/lib/hex-id';

export function getProfileType(role: 'FAN' | 'ARTIST' | 'VENUE'): ProfileType {
  if (role === 'ARTIST') return 'ARTIST';
  if (role === 'VENUE') return 'VENUE';
  return 'LISTENER';
}

export function getProfileCopy(type: ProfileType, name: string) {
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


  if (type === 'VENUE') {
    return {
      headline: `${name} is opening its doors to the next wave.`,
      bio: 'Describe the room, the neighborhood, and the kind of nights you want to host.',
      aboutContent: 'Tell artists and promoters what the venue feels like, what it supports, and who it is for.',
      requestContent: 'Set expectations for artist recommendations, booking notes, and how fans should use this request tab.'
    };
  }

  return {
    headline: `${name} is curating a personal listening world.`,
    bio: 'Introduce yourself, the scenes you love, and what you are always looking for next.',
    aboutContent: 'Tell people what kind of fan you are and what sounds stay in rotation.',
    topFiveContent: 'List your current top 5 artists, records, or live moments here.'
  };
}

/**
 * Every new profile starts UNVERIFIED, including the three creator types.
 *
 * This used to return PENDING for ARTIST/VENUE/DJ, which was wrong in three
 * compounding ways. PENDING is the state the admin queue at
 * /admin/verifications treats as "someone submitted evidence, go look at it" —
 * so stamping it at signup filled that queue with profiles that had no proof
 * attached and nothing to review. The venue and DJ onboarding wizards read
 * PENDING as "already submitted" and jumped straight to their done screen, so
 * a brand-new venue never saw a single step of its own wizard, verification
 * included. And POST /api/verify refuses a profile that is already VERIFIED
 * but happily accepted a PENDING one, so nothing downstream noticed.
 *
 * PENDING now means what the queue always assumed: evidence has been
 * submitted and is waiting on a human.
 */
export function getVerificationStatusForType(_type: ProfileType) {
  return 'UNVERIFIED' as const;
}

export async function generateUniqueProfileHexId() {
  let hexId = createHexId();

  while (await db.profile.findUnique({ where: { hexId } })) {
    hexId = createHexId();
  }

  return hexId;
}
