import { ProfileType } from '@prisma/client';
import { db } from '@/lib/db';
import { createHexId } from '@/lib/hex-id';

export function getProfileType(role: 'FAN' | 'ARTIST' | 'DJ' | 'VENUE'): ProfileType {
  if (role === 'ARTIST') return 'ARTIST';
  if (role === 'DJ') return 'DJ';
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

export function getVerificationStatusForType(type: ProfileType) {
  if (type === 'ARTIST' || type === 'VENUE' || type === 'DJ') {
    return 'PENDING' as const;
  }

  return 'UNVERIFIED' as const;
}

export async function generateUniqueProfileHexId() {
  let hexId = createHexId();

  while (await db.profile.findUnique({ where: { hexId } })) {
    hexId = createHexId();
  }

  return hexId;
}
