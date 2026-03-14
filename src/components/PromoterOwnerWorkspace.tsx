'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';

const LazyPromoterShowCreationTool = dynamic(
  () => import('@/components/PromoterShowCreationTool').then((module) => module.PromoterShowCreationTool),
  {
    ssr: false,
    loading: () => (
      <div className="panel">
        <div className="empty">Loading show recording tools...</div>
      </div>
    )
  }
);

type ArtistLibraryEntry = {
  id: string;
  hexId: string;
  title: string;
  url: string;
  notes: string | null;
};

type ArtistLibrary = {
  profileId: string;
  slug: string;
  name: string;
  heroImage: string | null;
  entries: ArtistLibraryEntry[];
};

type PromoterShowHistoryItem = {
  id: string;
  title: string;
  status: string;
  startsAtLabel: string;
  venueName: string | null;
  venuePostalCode: string | null;
  ticketsSoldCount: number;
  hypeCount: number;
  showPath: string;
};

type RecommendationHistoryItem = {
  id: string;
  venueName: string;
  artistName: string;
  status: string;
};

type PromoterOwnerWorkspaceProps = {
  artists: ArtistLibrary[];
  promoter: {
    profileId: string;
    name: string;
    slug: string;
  };
  recentShows: PromoterShowHistoryItem[];
  recommendations: RecommendationHistoryItem[];
  lifetimeStats: {
    totalShows: number;
    totalHype: number;
    totalTicketsSold: number;
    totalFans: number;
  };
};

const workspaceTabs = [
  { id: 'heuristics', label: 'Lifetime heuristics' },
  { id: 'history', label: 'Show history' },
  { id: 'recording', label: 'Show recording' }
] as const;

type WorkspaceTabId = (typeof workspaceTabs)[number]['id'];

export function PromoterOwnerWorkspace({
  artists,
  promoter,
  recentShows,
  recommendations,
  lifetimeStats
}: PromoterOwnerWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>('heuristics');
  const [selectedShowId, setSelectedShowId] = useState<string | null>(recentShows[0]?.id ?? null);
  const selectedShow = useMemo(
    () => recentShows.find((show) => show.id === selectedShowId) ?? recentShows[0] ?? null,
    [recentShows, selectedShowId]
  );

  return (
    <section className="section promoter-owner-workspace">
      <nav aria-label="Promoter owner workspace tabs" className="promoter-owner-tabs">
        {workspaceTabs.map((tab) => (
          <button
            className={tab.id === activeTab ? 'promoter-owner-tab active' : 'promoter-owner-tab'}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'heuristics' ? (
        <div className="panel promoter-owner-heuristics">
          <div className="grid grid-2">
            <div className="stat">
              <strong>{lifetimeStats.totalShows}</strong>
              Total shows
            </div>
            <div className="stat">
              <strong>{lifetimeStats.totalFans}</strong>
              Estimated fan reach
            </div>
            <div className="stat">
              <strong>{lifetimeStats.totalTicketsSold}</strong>
              Total tickets sold
            </div>
            <div className="stat">
              <strong>{lifetimeStats.totalHype}</strong>
              Total hype
            </div>
          </div>

          {selectedShow ? (
            <div className="promoter-history-selected panel">
              <div className="badge">Focused show heuristics</div>
              <h3>{selectedShow.title}</h3>
              <p className="meta">
                {selectedShow.startsAtLabel}
                {selectedShow.venueName ? ` | ${selectedShow.venueName}` : ''}
                {selectedShow.venuePostalCode ? ` | ZIP ${selectedShow.venuePostalCode}` : ''}
              </p>
              <div className="grid grid-3">
                <div className="stat">
                  <strong>{selectedShow.hypeCount}</strong>
                  Hype
                </div>
                <div className="stat">
                  <strong>{selectedShow.ticketsSoldCount}</strong>
                  Tickets sold
                </div>
                <div className="stat">
                  <strong>{selectedShow.status}</strong>
                  Status
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'history' ? (
        <div className="panel promoter-owner-history-panel">
          <div className="promoter-history-grid">
            <div className="promoter-history-card">
              <div className="promoter-history-card-head">
                <h3>Shows</h3>
                <span className="meta">Left click for heuristics, right click to open</span>
              </div>
              {recentShows.length ? (
                <div className="promoter-history-list">
                  {recentShows.map((show) => (
                    <button
                      className={show.id === selectedShowId ? 'promoter-history-item active' : 'promoter-history-item'}
                      key={show.id}
                      onClick={() => setSelectedShowId(show.id)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        window.open(show.showPath, '_blank', 'noopener,noreferrer');
                      }}
                      type="button"
                    >
                      <div>
                        <strong>{show.title}</strong>
                        <p className="meta">
                          {show.startsAtLabel}
                          {show.venuePostalCode ? ` | ZIP ${show.venuePostalCode}` : ''}
                        </p>
                      </div>
                      <span className="tag">{show.status}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty">No show history yet.</div>
              )}
            </div>

            <div className="promoter-history-card">
              <div className="promoter-history-card-head">
                <h3>Recommendations</h3>
                <span className="meta">{recommendations.length} sent</span>
              </div>
              {recommendations.length ? (
                <div className="promoter-history-list">
                  {recommendations.map((request) => (
                    <article className="promoter-history-item" key={request.id}>
                      <div>
                        <strong>{request.venueName}</strong>
                        <p className="meta">{request.artistName}</p>
                      </div>
                      <span className="tag">{request.status}</span>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty">No recommendation history yet.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'recording' ? (
        <LazyPromoterShowCreationTool
          artists={artists}
          initialPromoterProfileId={promoter.profileId}
          promoters={[promoter]}
        />
      ) : null}
    </section>
  );
}
