import type { DirectoryMediaSearchEntry } from '@/components/ProfileDirectoryBrowser';
import type { DiscoverSpotlightProfile } from '@/lib/discover-feed';

export type HypeQueueRole = 'fan' | 'artist' | 'promoter' | 'venue';

export type HypeQueueShowSignal = {
  title: string;
  headlinerSlug?: string | null;
  headlinerName?: string | null;
  venueName?: string | null;
};

export type HypeQueueItem = {
  id: string;
  category: 'local' | 'new' | 'similar' | 'promoter' | 'event' | 'wildcard';
  slotLabel: string;
  title: string;
  artistName: string;
  artistSlug: string;
  artistProfileId?: string | null;
  artistHypeCount?: number | null;
  mediaId: string;
  url: string;
  artworkUrl: string | null;
  notes: string | null;
  reasonChips: string[];
  whyNow: string;
};

type BuildHypeQueueInput = {
  role: HypeQueueRole;
  viewerLocationLabel: string;
  mediaEntries: DirectoryMediaSearchEntry[];
  hypedNearMe: DiscoverSpotlightProfile[];
  newArtists: DiscoverSpotlightProfile[];
  newPromoters: DiscoverSpotlightProfile[];
  shows?: HypeQueueShowSignal[];
};

const roleGoal: Record<HypeQueueRole, string> = {
  fan: 'new listens',
  artist: 'market learning',
  promoter: 'show building',
  venue: 'booking signal'
};

function profileLocation(profile: DiscoverSpotlightProfile) {
  return [profile.city, profile.stateRegion ?? profile.country].filter(Boolean).join(', ') || profile.scopeLabel;
}

function mediaForArtist(mediaEntries: DirectoryMediaSearchEntry[], artistSlug?: string | null) {
  if (!artistSlug) return null;
  return mediaEntries.find((entry) => entry.artistSlug === artistSlug) ?? null;
}

function firstUnusedMedia(mediaEntries: DirectoryMediaSearchEntry[], usedIds: Set<string>) {
  return mediaEntries.find((entry) => !usedIds.has(entry.mediaId)) ?? null;
}

function makeItem({
  category,
  slotLabel,
  media,
  profile,
  reasonChips,
  whyNow
}: {
  category: HypeQueueItem['category'];
  slotLabel: string;
  media: DirectoryMediaSearchEntry;
  profile?: DiscoverSpotlightProfile;
  reasonChips: string[];
  whyNow: string;
}): HypeQueueItem {
  return {
    id: `${category}-${media.id}`,
    category,
    slotLabel,
    title: media.title,
    artistName: media.artistName,
    artistSlug: media.artistSlug,
    artistProfileId: media.artistProfileId ?? profile?.id,
    artistHypeCount: media.artistHypeCount ?? profile?.hypeCount,
    mediaId: media.mediaId,
    url: media.url,
    artworkUrl: media.artworkUrl,
    notes: media.notes,
    reasonChips,
    whyNow
  };
}

export function buildHypeQueue({
  role,
  viewerLocationLabel,
  mediaEntries,
  hypedNearMe,
  newArtists,
  newPromoters,
  shows = []
}: BuildHypeQueueInput) {
  const usedIds = new Set<string>();
  const queue: HypeQueueItem[] = [];

  function add(item: HypeQueueItem | null) {
    if (!item || usedIds.has(item.mediaId)) return;
    usedIds.add(item.mediaId);
    queue.push(item);
  }

  for (const profile of hypedNearMe.slice(0, 3)) {
    const media = mediaForArtist(mediaEntries, profile.slug);
    if (!media) continue;
    add(
      makeItem({
        category: 'local',
        slotLabel: 'Local breakout',
        media,
        profile,
        reasonChips: [profile.scopeLabel, `${profile.hypeCount} hype`, profileLocation(profile)],
        whyNow: `${profile.name} is pulling nearby attention around ${viewerLocationLabel}. A full listen helps the HYPE engine test whether that signal should rise.`
      })
    );
  }

  for (const profile of newArtists.slice(0, 2)) {
    const media = mediaForArtist(mediaEntries, profile.slug);
    if (!media) continue;
    add(
      makeItem({
        category: 'new',
        slotLabel: 'New artist',
        media,
        profile,
        reasonChips: ['Fresh profile', profile.scopeLabel, `Since ${profile.createdAtLabel}`],
        whyNow: `${profile.name} is early enough that real listens can still shape whether the scene finds them.`
      })
    );
  }

  for (const media of mediaEntries.slice(0, 16)) {
    if (queue.filter((item) => item.category === 'similar').length >= 2) break;
    add(
      makeItem({
        category: 'similar',
        slotLabel: 'Signal match',
        media,
        reasonChips: ['Similar momentum', roleGoal[role], 'Full-listen weighted'],
        whyNow: `This pick gives ${roleGoal[role]} data beyond page views, so completed listens can influence what gets recommended next.`
      })
    );
  }

  const promoterPick = firstUnusedMedia(mediaEntries, usedIds);
  if (promoterPick) {
    const promoterSignal = newPromoters[0]?.name ? `${newPromoters[0].name} scene signal` : 'Promoter scene signal';
    add(
      makeItem({
        category: 'promoter',
        slotLabel: 'Promoter pick',
        media: promoterPick,
        reasonChips: [promoterSignal, 'Show potential', 'Curator lane'],
        whyNow: 'Promoter-adjacent picks help surface songs that could become part of radio-style shows and ticketed nights.'
      })
    );
  }

  const eventMedia =
    shows.map((show) => mediaForArtist(mediaEntries, show.headlinerSlug)).find(Boolean) ??
    firstUnusedMedia(mediaEntries, usedIds);
  if (eventMedia) {
    const show = shows.find((candidate) => candidate.headlinerSlug === eventMedia.artistSlug);
    add(
      makeItem({
        category: 'event',
        slotLabel: 'Event signal',
        media: eventMedia,
        reasonChips: [show?.venueName ?? 'Venue path', show?.title ?? 'Upcoming show', 'Ticket intent'],
        whyNow: 'Listening before an event gives venues and promoters better demand data than browsing alone.'
      })
    );
  }

  const wildcard = firstUnusedMedia([...mediaEntries].reverse(), usedIds);
  if (wildcard) {
    add(
      makeItem({
        category: 'wildcard',
        slotLabel: 'Wildcard',
        media: wildcard,
        reasonChips: ['Serendipity', 'Outside bubble', 'Discovery test'],
        whyNow: 'Wildcard listens keep the engine from becoming an echo chamber and give overlooked artists a fair shot.'
      })
    );
  }

  return queue.slice(0, 10);
}
