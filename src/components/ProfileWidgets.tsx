import Link from 'next/link';
import type { WidgetConfig, NowSpinningItem, GearItem, InfluenceItem, PressQuote, MerchItem, CollabRole } from '@/lib/widgets';

const panelStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.02)',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.06)',
  padding: '1rem 1.25rem',
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: '0.6rem',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  opacity: 0.4,
  fontFamily: 'var(--f-m, monospace)',
  marginBottom: 8,
};

export function NowSpinningWidget({ items }: { items: NowSpinningItem[] }) {
  const visible = items.slice(0, 5);
  return (
    <div className="artist-copy" style={panelStyle}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
      <div style={eyebrowStyle}>Now Spinning</div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map((item, i) => (
          <li key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {i === 0 && (
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent, #ff5029)', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
            )}
            {i !== 0 && <span style={{ opacity: 0.4, fontSize: '0.75rem' }}>▶</span>}
            {item.url ? (
              <a href={item.url} target="_blank" rel="noopener" style={{ color: 'inherit', textDecoration: 'none' }}>
                {item.label}
              </a>
            ) : (
              <span>{item.label}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GearListWidget({ items }: { items: GearItem[] }) {
  const grouped: Record<string, GearItem[]> = {};
  const ungrouped: GearItem[] = [];
  for (const item of items) {
    if (item.category) {
      (grouped[item.category] ||= []).push(item);
    } else {
      ungrouped.push(item);
    }
  }
  const hasGroups = Object.keys(grouped).length > 0;

  return (
    <div className="artist-copy" style={panelStyle}>
      <div style={eyebrowStyle}>Gear List</div>
      {hasGroups ? (
        Object.entries(grouped).map(([cat, catItems]) => (
          <div key={cat} style={{ marginBottom: 12 }}>
            <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.07)', borderRadius: 4, padding: '2px 6px', marginBottom: 8, display: 'inline-block', opacity: 0.7 }}>{cat}</span>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {catItems.map(item => (
                <li key={item.id}>
                  <div style={{ fontWeight: 600 }}>{item.name}</div>
                  {item.notes && <div style={{ fontSize: '0.75rem', opacity: 0.55 }}>{item.notes}</div>}
                </li>
              ))}
            </ul>
          </div>
        ))
      ) : null}
      {ungrouped.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ungrouped.map(item => (
            <li key={item.id}>
              <div style={{ fontWeight: 600 }}>{item.name}</div>
              {item.notes && <div style={{ fontSize: '0.75rem', opacity: 0.55 }}>{item.notes}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function InfluencesWidget({ items }: { items: InfluenceItem[] }) {
  return (
    <div className="artist-copy" style={panelStyle}>
      <div style={eyebrowStyle}>Influences</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {items.map(item => {
          const pillStyle: React.CSSProperties = {
            background: 'rgba(255,80,41,0.1)',
            border: '1px solid rgba(255,80,41,0.2)',
            borderRadius: 20,
            padding: '4px 10px',
            fontSize: '0.8rem',
            textDecoration: 'none',
            color: 'inherit',
            display: 'inline-block',
          };
          return item.profileSlug ? (
            <Link key={item.id} href={`/artists/${item.profileSlug}`} style={pillStyle}>
              {item.name}
            </Link>
          ) : (
            <span key={item.id} style={pillStyle}>{item.name}</span>
          );
        })}
      </div>
    </div>
  );
}

export function PressQuotesWidget({ items }: { items: PressQuote[] }) {
  return (
    <div className="artist-copy" style={panelStyle}>
      <div style={eyebrowStyle}>Press</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {items.map(item => (
          <blockquote key={item.id} style={{ margin: 0, paddingLeft: 12, borderLeft: '4px solid rgba(255,80,41,0.4)' }}>
            <p style={{ fontStyle: 'italic', margin: '0 0 4px' }}>&ldquo;{item.quote}&rdquo;</p>
            <footer style={{ fontSize: '0.75rem', opacity: 0.55 }}>
              {item.url ? (
                <a href={item.url} target="_blank" rel="noopener" style={{ color: 'inherit' }}>{item.publication}</a>
              ) : (
                item.publication
              )}
            </footer>
          </blockquote>
        ))}
      </div>
    </div>
  );
}

export function MerchShelfWidget({ items }: { items: MerchItem[] }) {
  return (
    <div className="artist-copy" style={panelStyle}>
      <div style={eyebrowStyle}>Merch</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 12 }}>
        {items.map(item => (
          <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {item.imageUrl && (
              <img src={item.imageUrl} alt={item.name} loading="lazy" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 6 }} />
            )}
            <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{item.name}</div>
            {item.price && <div style={{ fontSize: '0.75rem', opacity: 0.55 }}>{item.price}</div>}
            <a href={item.buyUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--accent, #ff5029)', textDecoration: 'none' }}>
              Get it →
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TourBannerWidget({ shows }: { shows: Array<{ id: string; title: string; startsAt: string; venueName?: string; slug?: string }> }) {
  if (!shows.length) return null;
  const visible = shows.slice(0, 3);
  return (
    <div className="artist-copy" style={panelStyle}>
      <div style={eyebrowStyle}>On Tour</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map(show => {
          const date = new Date(show.startsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          const inner = (
            <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', fontSize: '0.85rem' }}>
              <span style={{ opacity: 0.55, minWidth: 40, fontFamily: 'var(--f-m, monospace)', fontSize: '0.75rem' }}>{date}</span>
              <span style={{ fontWeight: 600 }}>{show.title}</span>
              {show.venueName && <span style={{ opacity: 0.55, fontSize: '0.75rem' }}>{show.venueName}</span>}
            </div>
          );
          return show.slug ? (
            <Link key={show.id} href={`/shows/${show.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              {inner}
            </Link>
          ) : (
            <div key={show.id}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}

export function CollabWishlistWidget({ items, openTo }: { items: CollabRole[]; openTo?: string }) {
  return (
    <div className="artist-copy" style={panelStyle}>
      <div style={eyebrowStyle}>Looking to Collab</div>
      {openTo && <p style={{ margin: '0 0 10px', fontSize: '0.85rem', opacity: 0.8 }}>{openTo}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {items.map(item => (
          <span key={item.id} style={{ border: '1px solid rgba(255,80,41,0.4)', borderRadius: 20, padding: '4px 10px', fontSize: '0.8rem', color: 'var(--accent, #ff5029)' }}>
            + {item.role}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ListeningStatsWidget({ topGenres, topArtists }: { topGenres: [string, number][]; topArtists: string[] }) {
  const genres = topGenres.slice(0, 5);
  const max = genres.reduce((m, [, v]) => Math.max(m, v), 0) || 1;
  const artists = topArtists.slice(0, 3);
  return (
    <div className="artist-copy" style={panelStyle}>
      <div style={eyebrowStyle}>What I&apos;m Into</div>
      {genres.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {genres.map(([genre, count]) => (
            <div key={genre}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 3 }}>
                <span>{genre}</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(count / max) * 100}%`, background: 'var(--accent, #ff5029)', borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {artists.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '0 0 10px', padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {artists.map(a => (
            <li key={a} style={{ fontSize: '0.8rem', opacity: 0.8 }}>{a}</li>
          ))}
        </ul>
      )}
      <div style={{ fontSize: '0.65rem', opacity: 0.4, fontFamily: 'var(--f-m, monospace)' }}>Based on iHYPE listening history</div>
    </div>
  );
}

export function ProfileWidgetsDisplay({
  config,
  upcomingShows,
  listeningData,
}: {
  config: WidgetConfig;
  upcomingShows: Array<{ id: string; title: string; startsAt: string; venueName?: string; slug?: string }>;
  listeningData?: { topGenres: [string, number][]; topArtists: string[] };
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {config.enabled.map(type => {
        switch (type) {
          case 'now_spinning': {
            const items = config.data.now_spinning?.items;
            if (!items?.length) return null;
            return <NowSpinningWidget key={type} items={items} />;
          }
          case 'gear_list': {
            const items = config.data.gear_list?.items;
            if (!items?.length) return null;
            return <GearListWidget key={type} items={items} />;
          }
          case 'influences': {
            const items = config.data.influences?.items;
            if (!items?.length) return null;
            return <InfluencesWidget key={type} items={items} />;
          }
          case 'press_quotes': {
            const items = config.data.press_quotes?.items;
            if (!items?.length) return null;
            return <PressQuotesWidget key={type} items={items} />;
          }
          case 'merch_shelf': {
            const items = config.data.merch_shelf?.items;
            if (!items?.length) return null;
            return <MerchShelfWidget key={type} items={items} />;
          }
          case 'tour_banner': {
            if (!config.data.tour_banner?.enabled || !upcomingShows.length) return null;
            return <TourBannerWidget key={type} shows={upcomingShows} />;
          }
          case 'collab_wishlist': {
            const data = config.data.collab_wishlist;
            if (!data?.items?.length && !data?.openTo) return null;
            return <CollabWishlistWidget key={type} items={data?.items ?? []} openTo={data?.openTo} />;
          }
          case 'listening_stats': {
            if (!config.data.listening_stats?.enabled || !listeningData) return null;
            if (!listeningData.topGenres.length && !listeningData.topArtists.length) return null;
            return <ListeningStatsWidget key={type} topGenres={listeningData.topGenres} topArtists={listeningData.topArtists} />;
          }
          default:
            return null;
        }
      })}
    </div>
  );
}
