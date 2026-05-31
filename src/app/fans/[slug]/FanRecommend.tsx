import { NetworkEarthGlobe } from '@/components/NetworkEarthGlobe';
import { FanRecommendationsPanel } from '@/components/FanRecommendationsPanel';
import type { RequestLocation } from '@/lib/request-location';
import type { DiscoverSpotlightProfile } from '@/lib/discover-feed';

type GlobeRouteStop = {
  id: string;
  title: string;
  href: string;
  venueName: string;
  venueSlug: string | null;
  city: string | null;
  stateRegion: string | null;
  country: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  startsAtLabel: string;
  timing: 'past';
};

type VenueEntry = {
  id: string;
  type: 'ARTIST' | 'DJ' | 'VENUE' | 'LISTENER';
  slug: string;
  hexId: string;
  name: string;
  contactInfo: string | null;
  addressLine1: string | null;
  hoursText: string | null;
  hometown: string | null;
  city: string | null;
  stateRegion: string | null;
  country: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  hypeCount: number;
  bio: string | null;
  genres: string[];
  avatarImage: string | null;
};

type NearbyEntry = {
  id: string;
  type: 'ARTIST' | 'DJ' | 'VENUE' | 'LISTENER';
  slug: string;
  hexId: string;
  name: string;
  contactInfo: string | null;
  addressLine1: string | null;
  hoursText: string | null;
  hometown: string | null;
  city: string | null;
  stateRegion: string | null;
  country: string | null;
  postalCode: string | null;
  hypeCount: number;
  bio: string | null;
  genres: string[];
  avatarImage: string | null;
  scopeLabel: string;
};

type PromoterGenreMatch = NearbyEntry & {
  matchedArtistNames: string[];
  matchedGenres: string[];
  relatedShowCount: number;
};

type ArtistEntry = DiscoverSpotlightProfile;

interface FanRecommendProps {
  globeRouteStops: GlobeRouteStop[];
  venues: VenueEntry[];
  viewerLocation: RequestLocation | null;
  nearbyVenues: NearbyEntry[];
  nearbyPromoters: NearbyEntry[];
  newArtists: ArtistEntry[];
  promoterGenreMatches: PromoterGenreMatch[];
  trendingArtists: ArtistEntry[];
}

export function FanRecommend({
  globeRouteStops,
  venues,
  viewerLocation,
  nearbyVenues,
  nearbyPromoters,
  newArtists,
  promoterGenreMatches,
  trendingArtists
}: FanRecommendProps) {
  return (
    <>
      <NetworkEarthGlobe
        description="Start at the detected ZIP from this request, highlight nearby venues, then zoom out to browse farther scenes and trace the shows this fan has already attended."
        emptyRouteLabel="No previous attended shows are mapped yet."
        routeLabel="Attended shows"
        routeStops={globeRouteStops}
        title="Earth globe for nearby venues and attended shows"
        venues={venues}
        viewerLocation={viewerLocation}
      />
      <FanRecommendationsPanel
        nearbyPromoters={nearbyPromoters}
        nearbyVenues={nearbyVenues}
        newArtists={newArtists}
        promoterGenreMatches={promoterGenreMatches}
        trendingArtists={trendingArtists}
        zipLabel={viewerLocation?.postalCode ?? viewerLocation?.city ?? viewerLocation?.stateRegion ?? null}
      />
    </>
  );
}
