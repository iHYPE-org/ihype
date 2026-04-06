import type { ReactNode } from 'react';
import { ProfileCard } from '@/components/ProfileCard';
import type { DirectoryBrowserProfile } from '@/components/ProfileDirectoryBrowser';
import type { DiscoverSpotlightProfile } from '@/lib/discover-feed';

type NearbyRecommendationProfile = DirectoryBrowserProfile & {
  scopeLabel: string;
};

type PromoterGenreMatch = NearbyRecommendationProfile & {
  matchedArtistNames: string[];
  matchedGenres: string[];
  relatedShowCount: number;
};

type FanRecommendationsPanelProps = {
  trendingArtists: DiscoverSpotlightProfile[];
  newArtists: DiscoverSpotlightProfile[];
  nearbyVenues: NearbyRecommendationProfile[];
  nearbyPromoters: NearbyRecommendationProfile[];
  promoterGenreMatches: PromoterGenreMatch[];
  zipLabel: string | null;
};

function SpotlightSection({
  title,
  description,
  emptyLabel,
  children,
  wide = false
}: {
  title: string;
  description: string;
  emptyLabel: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <article className={wide ? 'discover-explorer-section fan-recommendation-section wide' : 'discover-explorer-section fan-recommendation-section'}>
      <div className="discover-spotlight-head">
        <strong>{title}</strong>
        <span className="meta">{description}</span>
      </div>
      {children || <div className="empty">{emptyLabel}</div>}
    </article>
  );
}

export function FanRecommendationsPanel({
  trendingArtists,
  newArtists,
  nearbyVenues,
  nearbyPromoters,
  promoterGenreMatches,
  zipLabel
}: FanRecommendationsPanelProps) {
  return (
    <section className="section">
      <div className="panel discover-module-panel">
        <div className="discover-module-header">
          <div>
            <div className="badge">Recommendations</div>
            <h2>What to check next</h2>
          </div>
          <p className="meta">
            Built from the artists you already hype, the closest local and regional scenes, and promoters who keep
            programming genres you already lean toward.
            {zipLabel ? ` Localized around ${zipLabel}.` : ''}
          </p>
        </div>

        <div className="fan-recommendations-grid">
          <SpotlightSection
            description="Local and regional artists carrying the strongest hype around you right now."
            emptyLabel="No local or regional artist hype signals are available yet."
            title="Local and regional trending artists"
          >
            {trendingArtists.length ? (
              <div className="discover-spotlight-list">
                {trendingArtists.map((profile) => (
                  <article className="discover-spotlight-card" key={`fan-trending-${profile.id}`}>
                    <div className="discover-spotlight-topline">
                      <span className="badge">{profile.scopeLabel}</span>
                      <span className="meta">{profile.hypeCount} hype</span>
                    </div>
                    <ProfileCard profile={profile} />
                  </article>
                ))}
              </div>
            ) : null}
          </SpotlightSection>

          <SpotlightSection
            description="Fresh artists landing near your scene before everyone else finds them."
            emptyLabel="No newly launched local artists are showing up yet."
            title="New artists"
          >
            {newArtists.length ? (
              <div className="discover-spotlight-list">
                {newArtists.map((profile) => (
                  <article className="discover-spotlight-card" key={`fan-new-artist-${profile.id}`}>
                    <div className="discover-spotlight-topline">
                      <span className="badge">{profile.scopeLabel}</span>
                      <span className="meta">New since {profile.createdAtLabel}</span>
                    </div>
                    <ProfileCard profile={profile} />
                  </article>
                ))}
              </div>
            ) : null}
          </SpotlightSection>

          <SpotlightSection
            description="Rooms closest to your scene with pages fans can explore right now."
            emptyLabel="No nearby venues are mapped yet."
            title="Venues nearby"
          >
            {nearbyVenues.length ? (
              <div className="discover-spotlight-list">
                {nearbyVenues.map((profile) => (
                  <article className="discover-spotlight-card" key={`fan-nearby-venue-${profile.id}`}>
                    <div className="discover-spotlight-topline">
                      <span className="badge">{profile.scopeLabel}</span>
                      <span className="meta">{profile.hypeCount} hype</span>
                    </div>
                    <ProfileCard profile={profile} />
                  </article>
                ))}
              </div>
            ) : null}
          </SpotlightSection>

          <SpotlightSection
            description="Promoters operating closest to the scene you are browsing from."
            emptyLabel="No nearby promoters are surfacing yet."
            title="Promoters nearby"
          >
            {nearbyPromoters.length ? (
              <div className="discover-spotlight-list">
                {nearbyPromoters.map((profile) => (
                  <article className="discover-spotlight-card" key={`fan-nearby-promoter-${profile.id}`}>
                    <div className="discover-spotlight-topline">
                      <span className="badge">{profile.scopeLabel}</span>
                      <span className="meta">{profile.hypeCount} hype</span>
                    </div>
                    <ProfileCard profile={profile} />
                  </article>
                ))}
              </div>
            ) : null}
          </SpotlightSection>

          <SpotlightSection
            description="Promoters repeatedly booking artists from the genres you have already hyped."
            emptyLabel="Hype a few more artists and this promoter taste matching lane will fill in."
            title="Promoters aligned with the genres you hype"
            wide
          >
            {promoterGenreMatches.length ? (
              <div className="discover-spotlight-list">
                {promoterGenreMatches.map((profile) => (
                  <article className="discover-spotlight-card" key={`fan-genre-promoter-${profile.id}`}>
                    <div className="discover-spotlight-topline">
                      <span className="badge">{profile.scopeLabel}</span>
                      <span className="meta">{profile.relatedShowCount} related bookings</span>
                    </div>
                    <ProfileCard profile={profile} />
                    <p className="meta fan-recommendation-context">
                      Genres in rotation: {profile.matchedGenres.join(', ')}
                      {profile.matchedArtistNames.length ? ` | Artists booked: ${profile.matchedArtistNames.join(', ')}` : ''}
                    </p>
                  </article>
                ))}
              </div>
            ) : null}
          </SpotlightSection>
        </div>
      </div>
    </section>
  );
}
