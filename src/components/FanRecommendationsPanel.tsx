import Link from 'next/link';
import { ShowCard } from '@/components/ShowCard';

type RecommendationShow = Parameters<typeof ShowCard>[0]['show'];

type PromoterMatch = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  stateRegion: string | null;
  matchedArtistNames: string[];
  sharedShowCount: number;
};

type FanRecommendationsPanelProps = {
  nearbyShows: RecommendationShow[];
  trendingShows: RecommendationShow[];
  promoterMatches: PromoterMatch[];
  zipLabel: string | null;
};

export function FanRecommendationsPanel({
  nearbyShows,
  trendingShows,
  promoterMatches,
  zipLabel
}: FanRecommendationsPanelProps) {
  return (
    <section className="section">
      <div className="panel fan-recommendations-panel">
        <div className="fan-recommendations-header">
          <div>
            <div className="badge">Recommendations</div>
            <h2>What to check next</h2>
          </div>
          <p className="meta">
            Built from nearby events, trending shows, and promoters already working with artists you hype.
            {zipLabel ? ` Localized around ${zipLabel}.` : ''}
          </p>
        </div>

        <div className="fan-recommendations-grid">
          <article className="fan-recommendation-column">
            <h3>Events near you</h3>
            {nearbyShows.length ? (
              <div className="grid grid-2">
                {nearbyShows.map((show) => (
                  <ShowCard key={show.id} show={show} />
                ))}
              </div>
            ) : (
              <div className="empty">No local events match your ZIP yet.</div>
            )}
          </article>

          <article className="fan-recommendation-column">
            <h3>Trending shows</h3>
            {trendingShows.length ? (
              <div className="grid grid-2">
                {trendingShows.map((show) => (
                  <ShowCard key={show.id} show={show} />
                ))}
              </div>
            ) : (
              <div className="empty">Trending shows will appear here as hype builds.</div>
            )}
          </article>

          <article className="fan-recommendation-column">
            <h3>Promoters aligned with your taste</h3>
            {promoterMatches.length ? (
              <div className="fan-promoter-match-list">
                {promoterMatches.map((promoter) => (
                  <Link className="fan-promoter-match-card" href={`/promoters/${promoter.slug}`} key={promoter.id}>
                    <strong>{promoter.name}</strong>
                    <span>
                      {[promoter.city, promoter.stateRegion].filter(Boolean).join(', ') || 'Location building'}
                    </span>
                    <span>
                      Matches: {promoter.matchedArtistNames.join(', ')}
                    </span>
                    <span>{promoter.sharedShowCount} related show{promoter.sharedShowCount === 1 ? '' : 's'}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty">As you hype more artists, promoter recommendations will get smarter here.</div>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}
