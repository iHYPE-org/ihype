'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ProfileInsights } from '@/components/ProfileInsights';

type ModuleProfile = { id: string; type: string; name: string };

type TourData = {
  stops: { city: string; score: number; reach: string; showCount: number; venues: { id: string; name: string }[] }[];
  aiPlan: { summary: string; route: { city: string; order: number; why: string; targetVenue: string | null }[] } | null;
};

type AdRec = { headline: string; body: string; channel: string; cta: string };

const cardBase: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,.07)', borderRadius: 14,
  background: 'rgba(255,255,255,.03)', overflow: 'hidden',
};

const headBase: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 14, width: '100%', boxSizing: 'border-box',
  padding: '16px 18px', background: 'transparent', border: 'none', cursor: 'pointer',
  textAlign: 'left', color: 'inherit', font: 'inherit', textDecoration: 'none',
};

function ModuleHead({ icon, color, title, sub, trailing }: {
  icon: ReactNode; color: string; title: string; sub: string; trailing: ReactNode;
}) {
  return (
    <>
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${color}1f`,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, letterSpacing: '-.01em', color: 'var(--ink)', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-a50)', marginTop: 2, overflowWrap: 'break-word', wordBreak: 'break-word' }}>{sub}</div>
      </div>
      <div style={{ flexShrink: 0, color: 'var(--ink-a45)', display: 'flex', alignItems: 'center' }}>{trailing}</div>
    </>
  );
}

function ExpandModule({ icon, color, title, sub, children }: {
  icon: ReactNode; color: string; title: string; sub: string; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={cardBase}>
      <button onClick={() => setOpen((o) => !o)} style={headBase} type="button">
        <ModuleHead
          color={color} icon={icon} sub={sub} title={title}
          trailing={
            <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 180ms cubic-bezier(0.2,0.7,0.3,1)' }} viewBox="0 0 24 24" width="16">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          }
        />
      </button>
      {open && <div style={{ padding: '4px 18px 20px' }}>{children}</div>}
    </div>
  );
}

function LinkModule({ icon, color, title, sub, href }: {
  icon: ReactNode; color: string; title: string; sub: string; href: string;
}) {
  return (
    <div style={cardBase}>
      <Link href={href} style={headBase}>
        <ModuleHead
          color={color} icon={icon} sub={sub} title={title}
          trailing={
            <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          }
        />
      </Link>
    </div>
  );
}

function LoadNote({ text }: { text: string }) {
  return <p style={{ fontSize: 13, color: 'var(--ink-a45)', margin: '8px 0 0' }}>{text}</p>;
}

/**
 * Tour recommendations for artist pages — surfaces the previously-unwired
 * /api/tour/suggestions engine: demand-ranked cities from real hype data,
 * plus an AI-routed itinerary when the AI binding is up.
 */
function TourRecsBody() {
  const [data, setData] = useState<TourData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/tour/suggestions')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error) return <LoadNote text="Couldn't load tour recommendations right now." />;
  if (!data) return <LoadNote text="Reading the demand radar…" />;
  if (data.stops.length === 0) return <LoadNote text="Not enough demand data yet — tour recommendations fill in as fans hype shows and venues." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {data.aiPlan && (
        <div style={{ borderLeft: '2px solid #ff5029', paddingLeft: 12 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#ff5029', marginBottom: 6 }}>
            AI ROUTE
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-a75)', margin: '0 0 10px', lineHeight: 1.5 }}>{data.aiPlan.summary}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.aiPlan.route.map((r) => (
              <div key={`${r.order}-${r.city}`} style={{ display: 'flex', gap: 10 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ff5029', flexShrink: 0, width: 18 }}>
                  {String(r.order).padStart(2, '0')}
                </span>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                    {r.city}{r.targetVenue ? <span style={{ fontWeight: 400, color: 'var(--ink-a55)' }}> · {r.targetVenue}</span> : null}
                  </span>
                  {r.why && <div style={{ fontSize: 12, color: 'var(--ink-a50)', marginTop: 2, lineHeight: 1.45 }}>{r.why}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-a40)', marginBottom: 8 }}>
          DEMAND-RANKED CITIES
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {data.stops.slice(0, 6).map((s) => (
            <div key={s.city} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{s.city}</span>
                {s.venues[0] && <span style={{ fontSize: 12, color: 'var(--ink-a50)' }}> · {s.venues.map((v) => v.name).slice(0, 2).join(', ')}</span>}
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-a55)', flexShrink: 0 }}>
                {s.score} · {s.reach} reach
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Advertising recommendations — surfaces the previously-unwired
 * /api/page-builder/ad-recs engine for the selected page.
 */
function AdRecsBody({ profileId }: { profileId: string }) {
  const [recs, setRecs] = useState<AdRec[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/page-builder/ad-recs?profileId=${profileId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setRecs(d.recs ?? []))
      .catch(() => setError(true));
  }, [profileId]);

  if (error) return <LoadNote text="Couldn't load ad recommendations right now." />;
  if (!recs) return <LoadNote text="Drafting campaign ideas…" />;
  if (recs.length === 0) return <LoadNote text="No recommendations yet." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {recs.map((r, i) => (
        <div key={i} style={{ border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: '12px 14px', background: 'rgba(255,255,255,.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, color: '#b983ff', background: 'rgba(185,131,255,.14)' }}>
              {r.channel}
            </span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>{r.headline}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-a55)', lineHeight: 1.5 }}>{r.body}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#b983ff', marginTop: 6 }}>{r.cta}</div>
        </div>
      ))}
      <Link href="/advertise" style={{ fontSize: 12, color: 'var(--ink-a55)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
        Run a campaign on iHYPE →
      </Link>
    </div>
  );
}

const icons = {
  stats: (color: string) => (
    <svg fill="none" height="18" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="18">
      <line x1="6" x2="6" y1="20" y2="12" /><line x1="12" x2="12" y1="20" y2="4" /><line x1="18" x2="18" y1="20" y2="9" />
    </svg>
  ),
  event: (color: string) => (
    <svg fill="none" height="18" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="18">
      <rect height="16" rx="2" width="18" x="3" y="5" /><line x1="3" x2="21" y1="10" y2="10" /><line x1="12" x2="12" y1="13" y2="17" /><line x1="10" x2="14" y1="15" y2="15" />
    </svg>
  ),
  tour: (color: string) => (
    <svg fill="none" height="18" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="18">
      <path d="M21 10c0 6-9 12-9 12S3 16 3 10a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  ),
  radio: (color: string) => (
    <svg fill="none" height="18" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="18">
      <circle cx="12" cy="12" r="2" /><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
    </svg>
  ),
  ads: (color: string) => (
    <svg fill="none" height="18" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="18">
      <path d="M3 11l18-5v12L3 13v-2z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  ),
};

/**
 * Role-specific toolkit rendered under the selected page on Pages → My Page.
 * Every page type gets real stats (ProfileInsights aggregates); creator roles
 * additionally get their working tools — Artist: event creator, tour + ad
 * recommendations; Venue: event creation + ad recommendations; DJ: radio show
 * creator + ad recommendations.
 */
export function PageRoleModules({ profile, color }: { profile: ModuleProfile; color: string }) {
  const isArtist = profile.type === 'ARTIST';
  const isVenue = profile.type === 'VENUE';
  const isDj = profile.type === 'DJ';

  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-a35)', marginBottom: 14 }}>
        PAGE TOOLKIT
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <ExpandModule
          color={color}
          icon={icons.stats(color)}
          sub="Your hypes, followers & listeners"
          title="Stats"
        >
          <ProfileInsights profileId={profile.id} profileType={profile.type} />
        </ExpandModule>

        {(isArtist || isVenue) && (
          <LinkModule
            color={color}
            href="/events/new"
            icon={icons.event(color)}
            sub={isVenue ? 'Book your room — keep 45%' : 'Sell tickets direct — keep 45%'}
            title="Event creator"
          />
        )}

        {isDj && (
          <LinkModule
            color={color}
            href="/radio/studio"
            icon={icons.radio(color)}
            sub="Go live or schedule a show"
            title="Radio show"
          />
        )}

        {isArtist && (
          <ExpandModule
            color={color}
            icon={icons.tour(color)}
            sub="Cities fans want you to play"
            title="Tour picks"
          >
            <TourRecsBody />
          </ExpandModule>
        )}

        {(isArtist || isVenue || isDj) && (
          <ExpandModule
            color={color}
            icon={icons.ads(color)}
            sub="AI ad ideas for this page"
            title="Ad ideas"
          >
            <AdRecsBody profileId={profile.id} />
          </ExpandModule>
        )}
      </div>
    </div>
  );
}
