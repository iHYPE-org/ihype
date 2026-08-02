import type { Prisma } from '@prisma/client';

export function releasedMediaWhere(now = new Date()): Prisma.ArtistMediaAssetWhereInput {
  return {
    isPublished: true,
    OR: [{ publishAt: null }, { publishAt: { lte: now } }],
  };
}

export function isMediaReleased(
  media: { isPublished: boolean; publishAt?: Date | null },
  now = new Date(),
) {
  return media.isPublished && (!media.publishAt || media.publishAt <= now);
}
