import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { ShowCard } from '@/components/ShowCard';
import type { VenueBookingScopeGroup } from '@/lib/venue-booking';

type DiscoverShow = Parameters<typeof ShowCard>[0]['show'];

type DiscoverStatItem = {
  label: string;
  value: string | number;
};

type DiscoverOpportunity = {
  title: string;
  summary: string;
  detail: string;
};

function DiscoverModuleShell({
  badge,
  title,
  description,
  children
}: {
  badge: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="section">
      <div className="panel discover-module-panel">
        <div className="discover-module-header">
          <div>
            <div className="badge">{badge}</div>
            <h2>{title}</h2>
          </div>
          <p className="meta">{description}</p>
        </div>
        {children}
      </div>
    </section>
  );
}

export function DiscoverStatsPanel({
  badge,
  title,
  description,
  stats,
  highlights
}: {
  badge: string;
  title: string;
  description: string;
  stats: DiscoverStatItem[];
  highlights?: string[];
}) {
  return (
    <DiscoverModuleShell badge={badge} description={description} title={title}>
      <div className="discover-stat-grid">
        {stats.map((stat) => (
          <div className="discover-stat-card" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>

      {highlights?.length ? (
        <div className="discover-market-strip" aria-label="Top focus markets">
          {highlights.map((highlight) => (
            <span className="discover-market-pill" key={highlight}>
              {highlight}
            </span>
          ))}
        </div>
      ) : null}
    </DiscoverModuleShell>
  );
}

export function DiscoverRecommendationPanel({
  badge,
  title,
  description,
  opportunities
}: {
  badge: string;
  title: string;
  description: string;
  opportunities: DiscoverOpportunity[];
}) {
  return (
    <DiscoverModuleShell badge={badge} description={description} title={title}>
      <div className="discover-recommendation-grid">
        {opportunities.map((opportunity) => (
          <article className="discover-recommendation-card" key={opportunity.title}>
            <strong>{opportunity.title}</strong>
            <p>{opportunity.summary}</p>
            <span>{opportunity.detail}</span>
          </article>
        ))}
      </div>
    </DiscoverModuleShell>
  );
}

export function DiscoverTicketHubPanel({
  shows
}: {
  shows: DiscoverShow[];
}) {
  return (
    <DiscoverModuleShell
      badge="Ticket hub"
      description="Track ticketed shows that are open now, moving fast, or worth watching next."
      title="Ticketed shows in motion"
    >
      {shows.length ? (
        <div className="grid grid-2">
          {shows.map((show) => (
            <ShowCard key={show.id} show={show} />
          ))}
        </div>
      ) : (
        <div className="empty">No ticketed shows are open right now.</div>
      )}
    </DiscoverModuleShell>
  );
}

export function DiscoverEventsPanel({
  badge,
  title,
  description,
  shows,
  emptyLabel
}: {
  badge: string;
  title: string;
  description: string;
  shows: DiscoverShow[];
  emptyLabel: string;
}) {
  return (
    <DiscoverModuleShell badge={badge} description={description} title={title}>
      {shows.length ? (
        <div className="grid grid-2">
          {shows.map((show) => (
            <ShowCard key={show.id} show={show} />
          ))}
        </div>
      ) : (
        <div className="empty">{emptyLabel}</div>
      )}
    </DiscoverModuleShell>
  );
}

export function DiscoverMyPagePanel({
  roleLabel,
  title,
  description,
  name,
  headline,
  summary,
  metaLine,
  publicHref,
  editHref,
  previewTabs = [],
  tags = [],
  previewStyle
}: {
  roleLabel: string;
  title: string;
  description: string;
  name: string;
  headline: string;
  summary: string;
  metaLine?: string | null;
  publicHref: string;
  editHref: string;
  previewTabs?: string[];
  tags?: string[];
  previewStyle?: CSSProperties;
}) {
  return (
    <DiscoverModuleShell badge="My page" description={description} title={title}>
      <div className="discover-creator-grid">
        <div className="discover-creator-column">
          <div className="profile-design-preview-shell profile-design-shell" style={previewStyle}>
            <div className="profile-design-preview-card">
              <div className="profile-design-preview-hero">
                <div className="profile-design-preview-topline">
                  <span className="badge">{roleLabel}</span>
                </div>
                <strong>{name}</strong>
                <p className="profile-design-preview-headline">{headline}</p>
                <p className="profile-design-preview-copy">{summary}</p>
                {metaLine ? <p className="profile-design-preview-copy">{metaLine}</p> : null}
                {tags.length ? (
                  <div className="tag-row">
                    {tags.slice(0, 4).map((tag) => (
                      <span className="tag" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              {previewTabs.length ? (
                <div className="profile-design-preview-tabs">
                  {previewTabs.map((tab, index) => (
                    <span
                      className={index === 0 ? 'profile-design-preview-tab active' : 'profile-design-preview-tab'}
                      key={tab}
                    >
                      {tab}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="discover-creator-column">
          <div className="discover-simple-list">
            <div className="discover-simple-link">
              <strong>Public page</strong>
              <span>Open the live page exactly the way other people see it.</span>
            </div>
            <div className="discover-simple-link">
              <strong>Edit page</strong>
              <span>Jump back to your dashboard editor to change the layout, look, and content.</span>
            </div>
          </div>

          <div className="cta-row">
            <Link className="button secondary" href={publicHref}>
              View my page
            </Link>
            <Link className="button secondary" href={editHref}>
              Edit page
            </Link>
          </div>
        </div>
      </div>
    </DiscoverModuleShell>
  );
}

export function DiscoverCreatorPanel({
  badge,
  title,
  description,
  actionHref,
  actionLabel,
  children
}: {
  badge: string;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  children: ReactNode;
}) {
  return (
    <DiscoverModuleShell badge={badge} description={description} title={title}>
      <div className="discover-creator-content">{children}</div>
      {actionHref && actionLabel ? (
        <div className="cta-row">
          <Link className="button secondary" href={actionHref}>
            {actionLabel}
          </Link>
        </div>
      ) : null}
    </DiscoverModuleShell>
  );
}

export function VenueBookingRecommendationEngine({
  currentHref,
  scopes
}: {
  currentHref: string;
  scopes: VenueBookingScopeGroup[];
}) {
  return (
    <DiscoverModuleShell
      badge="Recommendation engine"
      description="Fan request signals are grouped by local, regional, national, and global scope so venues can see who to book next."
      title="Venue booking recommendations"
    >
      <div className="venue-booking-scope-grid">
        {scopes.map((scope) => (
          <section className="venue-booking-scope-card" key={scope.key}>
            <div className="venue-booking-scope-head">
              <div>
                <strong>{scope.label}</strong>
                <p>{scope.description}</p>
              </div>
            </div>

            {scope.artists.length ? (
              <div className="venue-booking-artist-list">
                {scope.artists.map((artist) => (
                  <article className="venue-booking-artist-card" key={`${scope.key}-${artist.id}`}>
                    <div className="venue-booking-artist-topline">
                      <strong>{artist.name}</strong>
                      <span>{artist.requestCount} fan request{artist.requestCount === 1 ? '' : 's'}</span>
                    </div>
                    <p>{[artist.city, artist.stateRegion ?? artist.country].filter(Boolean).join(', ') || 'Location building'}</p>
                    <p>{artist.rationale}</p>
                    <p>{artist.availabilitySummary}</p>
                    {artist.nextShowAtLabel ? <span>Next scheduled show: {artist.nextShowAtLabel}</span> : null}
                    <div className="cta-row">
                      <Link className="button small secondary" href={`${currentHref}?module=event-creator&artist=${artist.id}`}>
                        Use in event creator
                      </Link>
                      <Link className="button small secondary" href={`/artists/${artist.slug}`}>
                        Open artist
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty">No fan-requested artists are concentrated in this scope yet.</div>
            )}
          </section>
        ))}
      </div>
    </DiscoverModuleShell>
  );
}
