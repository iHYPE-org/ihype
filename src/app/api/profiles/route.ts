import { NextResponse } from 'next/server';
import type { Prisma, ProfileType } from '@prisma/client/wasm';
import { db } from '@/lib/db';
import { getDemoOwnerExclusion } from '@/lib/runtime-flags';

export const dynamic = 'force-dynamic';

const VALID_TYPES: ProfileType[] = ['ARTIST', 'DJ', 'VENUE', 'LISTENER'];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const typeParam = searchParams.get('type')?.toUpperCase() as ProfileType | null;
  const limitParam = Number.parseInt(searchParams.get('limit') ?? '40', 10);
  const limit = Math.min(Math.max(1, Number.isNaN(limitParam) ? 40 : limitParam), 200);
  const q = searchParams.get('q')?.trim() ?? '';

  const typeFilter: Prisma.ProfileWhereInput =
    typeParam && VALID_TYPES.includes(typeParam) ? { type: typeParam } : {};

  const textFilter: Prisma.ProfileWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { headline: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
          { stateRegion: { contains: q, mode: 'insensitive' } }
        ]
      }
    : {};

  const profiles = await db.profile.findMany({
    where: {
      ...typeFilter,
      ...textFilter,
      ...getDemoOwnerExclusion()
    },
    orderBy: [{ hypeCount: 'desc' }, { verified: 'desc' }, { name: 'asc' }],
    take: limit,
    select: {
      id: true,
      slug: true,
      hexId: true,
      type: true,
      name: true,
      bio: true,
      headline: true,
      city: true,
      stateRegion: true,
      country: true,
      hypeCount: true,
      verified: true,
      avatarImage: true,
      genres: true
    }
  });

  return NextResponse.json(profiles);
}
