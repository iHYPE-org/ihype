import type { Metadata } from 'next';
import { cache } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { HypeButton } from '@/components/HypeButton';
import { VenueRequestForm } from '@/components/VenueRequestForm';
import { ProfileInsights } from '@/components/ProfileInsights';
import { getDemoCreatorExclusion, isDemoUser, shouldHideDemoContent } from '@/lib/runtime-flags';
import { resolveProfileThemeVars } from '@/lib/profile-design';

export const revalidate = 60;

const venueSections = ['about', 'shows', 'request', 'insights'] as const;
type VenueSection = (typeof venueSections)[number];

function getActiveSection(section: string | string[] | undefined): VenueSection {
  if (typeof section === 'string' && venueSections.includes(section as VenueSection)) return section as VenueSection;
  return 'about';
}

const SECTION_LABEL: Record<VenueSection, string> = {
  about: 'About',
  shows: 'Upcoming Shows',
  request: 'Request Artist',
  insights: 'Insights',
};

const getVenueMeta = cache((slug: string) =>
  db.profile.findUnique({
    where: { slug },
    select: { name: true, headline: true, bio: true, city: true, stateRegion: true, hypeCount: true, avatarImage: true },
  })
);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getVenueMeta(slug);
  if (!profile) return { title: 'Venue · iHYPE' };
  const loc = [profile.city, profile.stateRegion].filter(Boolean).join(', ');
  return {
    title: `${profile.name} · iHYPE`,
    description: ['Venue', loc || null, profile.headline || null].filter(Boolean).join(' · '),
  };
}

export default async function VenuePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ section?: string | string[] }>;
}) {
  const session = await auth();
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeSection = getActiveSection(resolvedSearchParams.section);

  const profile = await db.profile.findUnique({
    where: { slug },
    include: { owner: { select: { email: true, username: true } } },
  });
  if (!profile || profile.type !== 'VENUE') return notFound();
  if (shouldHideDemoContent() && isDemoUser(profile.owner)) return notFound();

  const isOwner = Boolean(session?.user?.id && session.user.id === profile.ownerId);
  const themeVars = resolveProfileThemeVars(profile);

  const [shows, userHype] = await Promise.all([
    db.show.findMany({
      where: { venueProfileId: profile.id, ...getDemoCreatorExclusion() },
      include: { headlinerProfile: true },
      orderBy: { startsAt: 'asc' },
    }),
    session?.user?.id
      ? db.profileHypeEvent.findUnique({ where: { userId_profileId: { userId: session.user.id, profileId: profile.id } }, select: { userId: true } })
      : null,
  ]);

  const now = new Date();
  const upcomingShows = shows.filter((s) => s.status === 'LIVE' || s.startsAt >= now);
  const totalTicketsSold = shows.reduce((sum, s) => sum + s.ticketsSoldCount, 0);
  const venueAddress = [profile.addressLine1, profile.city, profile.stateRegion, profile.postalCode].filter(Boolean).join(', ');
  const avgFillPct = shows.length > 0
    ? Math.round(shows.reduce((sum, s) => sum + (s.ticketCapacity ? Math.min(1, s.ticketsSoldCount / s.ticketCapacity) : 0), 0) / shows.length * 100)
    : 0;

  return (
    <div className="venue-page" style={(themeVars ?? undefined) as React.CSSProperties | undefined}>
      <div className="venue-hero">
        <div className="venue-avatar">
          {profile.avatarImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={profile.name} src={profile.avatarImage} fetchPriority="high" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 16 }} />
          ) : (
            <svg fill="none" height="26" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" width="26"><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /><path d="M9 9v.01M9 12v.01M9 15v.01" /></svg>
          )}
        </div>
        <div className="venue-info">
          <h1>{profile.name}</h1>
          <p>{[profile.addressLine1, [profile.city, profile.stateRegion].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</p>
          <div className="venue-badges">
            <span className="venue-badge venue-badge-venue">Venue</span>
            {profile.verificationStatus === 'VERIFIED' && <span className="venue-badge venue-badge-verified">✓ Verified</span>}
          </div>
          <div className="venue-stats">
            <div className="venue-stat"><div className="venue-stat-val">{shows.length}</div><div className="venue-stat-label">Shows hosted</div></div>
            <div className="venue-stat"><div className="venue-stat-val">{totalTicketsSold.toLocaleString()}</div><div className="venue-stat-label">Tickets sold</div></div>
            <div className="venue-stat"><div className="venue-stat-val">45%</div><div className="venue-stat-label">Your cut, always</div></div>
          </div>
          {shows.length > 0 && (
            <div className="venue-capacity-row">
              <div className="venue-capacity-label"><span>Avg capacity fill</span><b>{avgFillPct}%</b></div>
              <div className="venue-capacity-track"><div className="venue-capacity-bar" style={{ width: `${avgFillPct}%` }} /></div>
            </div>
          )}
          <div className="venue-hero-actions">
            <HypeButton entityLabel="venue" initialCount={profile.hypeCount} initiallyHyped={!!userHype} targetId={profile.id} targetType="profile" />
            {isOwner && (
              <>
                <Link className="venue-hero-btn" href="/me/booking">Book artists</Link>
                <Link className="venue-hero-btn" href="/pages">Customize</Link>
                <Link className="venue-hero-btn" href="/settings">Settings</Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="venue-content">
        <div className="venue-tabs">
          {venueSections.filter((section) => section !== 'insights' || isOwner).map((section) => (
            <Link className={section === activeSection ? 'venue-tab active' : 'venue-tab'} href={`/venues/${profile.slug}?section=${section}`} key={section}>
              {SECTION_LABEL[section]}
            </Link>
          ))}
        </div>

        {activeSection === 'about' && (
          <div>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--ink-a85)', marginBottom: 28 }}>
              {profile.aboutContent || profile.bio || 'This venue has not filled out the About section yet.'}
            </p>
            {(venueAddress || profile.hoursText) && (
              <p style={{ fontSize: 13, color: 'var(--ink-a60)', marginBottom: 28 }}>
                {venueAddress}{profile.hoursText ? ` · ${profile.hoursText}` : ''}
              </p>
            )}
            <div className="venue-split-card">
              <div className="venue-split-title">How every ticket is split here</div>
              <div className="venue-split-bar">
                <div className="venue-split-seg venue-artist-seg"><div className="venue-seg-pct" style={{ color: '#ff5029' }}>45%</div><div className="venue-seg-label" style={{ color: '#ff5029' }}>Artist</div></div>
                <div className="venue-split-seg venue-venue-seg"><div className="venue-seg-pct" style={{ color: 'var(--role-venue)' }}>45%</div><div className="venue-seg-label" style={{ color: 'var(--role-venue)' }}>{profile.name}</div></div>
                <div className="venue-split-seg venue-promoter-seg"><div className="venue-seg-pct" style={{ color: '#ff3e9a' }}>10%</div><div className="venue-seg-label" style={{ color: '#ff3e9a' }}>Promoters</div></div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--ink-a50)', marginTop: 12 }}>$0 fees for ticket buyers. iHYPE takes nothing — locked in the charter.</p>
            </div>
          </div>
        )}

        {activeSection === 'shows' && (
          <div>
            {upcomingShows.length === 0 ? (
              <p style={{ color: 'var(--ink-a50)' }}>No upcoming shows yet.</p>
            ) : (
              upcomingShows.map((show) => {
                const date = show.startsAt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
                const time = show.startsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                return (
                  <Link className="venue-show-card" href={`/shows/${show.slug}`} key={show.id}>
                    <div className="venue-show-info">
                      <h3>{show.headlinerProfile?.name ?? show.title}</h3>
                      <p className="venue-show-meta">{date} · {time} · {show.ticketsSoldCount.toLocaleString()} tickets sold</p>
                    </div>
                    <div className="venue-show-price">
                      {show.isTicketed && show.ticketPriceCents ? `$${(show.ticketPriceCents / 100).toFixed(0)}` : 'Free'}
                      <small>$0 fees</small>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        )}

        {activeSection === 'request' && (
          <div>
            <p style={{ fontSize: 14, color: 'var(--ink-a70)', marginBottom: 24 }}>
              We use the iHYPE demand radar to book artists. Fill this out and we&apos;ll reach out if there&apos;s a fit.
            </p>
            {session?.user ? (
              <VenueRequestForm venueProfileId={profile.id} />
            ) : (
              <p style={{ color: 'var(--ink-a50)' }}>Log in to recommend booking an artist for this venue.</p>
            )}
          </div>
        )}

        {activeSection === 'insights' && isOwner && (
          <ProfileInsights profileId={profile.id} profileType={profile.type} />
        )}
      </div>

      <style>{`
        .venue-page { max-width: 640px; margin: 0 auto; padding: 32px 0 100px; }
        .venue-hero { background: var(--profile-hero, linear-gradient(160deg, rgba(34,229,212,.18), rgba(185,131,255,.1))); border-bottom: 1px solid var(--profile-border, rgba(34,229,212,.2)); padding: 48px 32px 40px; display: flex; gap: 32px; align-items: flex-start; flex-wrap: wrap; }
        .venue-avatar { width: 100px; height: 100px; border-radius: 16px; background: var(--profile-hero, linear-gradient(135deg,#22e5d4,#b983ff)); flex-shrink: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .venue-info h1 { font-family: var(--font-display); font-size: 32px; font-weight: 800; letter-spacing: -.02em; margin-bottom: 6px; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .venue-info p { font-size: 14px; color: var(--ink-a70); margin-bottom: 16px; }
        .venue-badges { display: flex; gap: 10px; flex-wrap: wrap; }
        .venue-badge { display: inline-block; padding: 5px 12px; border-radius: 4px; font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: .14em; }
        .venue-badge-venue { background: rgba(34,229,212,.15); color: var(--role-venue, #22e5d4); }
        .venue-badge-verified { background: rgba(255,80,41,.15); color: var(--accent); }
        .venue-stats { display: flex; gap: 32px; margin-top: 20px; }
        .venue-stat { text-align: center; }
        .venue-stat-val { font-size: 22px; font-weight: 700; color: var(--profile-accent, var(--role-venue, #22e5d4)); }
        .venue-stat-label { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-a50); }
        .venue-capacity-row { margin-top: 22px; max-width: 320px; }
        .venue-capacity-label { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px; }
        .venue-capacity-label b { font-family: var(--font-display); font-weight: 800; color: var(--profile-accent, var(--role-venue, #22e5d4)); }
        .venue-capacity-track { height: 8px; border-radius: 9999px; background: rgba(255,255,255,.08); overflow: hidden; }
        .venue-capacity-bar { height: 100%; border-radius: 9999px; background: var(--profile-accent, var(--role-venue, #22e5d4)); }
        .venue-hero-actions { display: flex; gap: 10px; margin-top: 22px; align-items: center; flex-wrap: wrap; }
        .venue-hero-btn { display: inline-flex; align-items: center; gap: 7px; padding: 10px 18px; border-radius: 9px; font-size: 13px; font-weight: 700; text-decoration: none; background: var(--line); color: var(--ink); border: 1px solid rgba(255,255,255,.1); }
        .venue-hero-btn:hover { background: rgba(255,255,255,.1); }
        .venue-content { padding: 0 32px; }
        .venue-tabs { display: flex; gap: 24px; border-bottom: 1px solid var(--line); margin: 32px 0 28px; }
        .venue-tab { padding: 10px 0; border-bottom: 2px solid transparent; cursor: pointer; font-weight: 600; font-size: 14px; color: var(--ink-a60); text-decoration: none; }
        .venue-tab.active { color: var(--ink); border-color: var(--profile-accent, var(--role-venue, #22e5d4)); }
        .venue-show-card { border: 1px solid var(--line); border-radius: 10px; padding: 20px; background: var(--bg2); display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; text-decoration: none; color: inherit; }
        .venue-show-card:hover { background: var(--bg3); border-color: var(--line-2); }
        .venue-show-info { min-width: 0; }
        .venue-show-info h3 { font-family: var(--font-display); font-size: 16px; font-weight: 800; margin-bottom: 4px; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .venue-show-meta { font-size: 13px; color: var(--ink-a60); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .venue-show-price { font-size: 18px; font-weight: 700; color: var(--accent); text-align: right; flex-shrink: 0; }
        .venue-show-price small { font-size: 11px; color: var(--ink-a50); font-weight: 400; display: block; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .12em; }
        .venue-split-card { border: 1px solid rgba(34,229,212,.2); border-radius: 10px; padding: 24px; background: rgba(34,229,212,.05); margin-bottom: 24px; }
        .venue-split-title { font-family: var(--font-display); font-size: 16px; font-weight: 800; margin-bottom: 16px; color: var(--ink); }
        .venue-split-bar { display: flex; gap: 0; border-radius: 8px; overflow: hidden; }
        .venue-split-seg { flex: 1; padding: 14px; text-align: center; }
        .venue-artist-seg { background: rgba(255,80,41,.15); }
        .venue-venue-seg { background: rgba(34,229,212,.15); }
        .venue-promoter-seg { background: rgba(255,62,154,.15); }
        .venue-seg-pct { font-size: 18px; font-weight: 700; }
        .venue-seg-label { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .12em; margin-top: 4px; }

        @media (max-width: 600px) {
          .venue-hero { padding: 28px 20px 24px; flex-direction: column; align-items: center; text-align: center; gap: 16px; }
          .venue-avatar { width: 88px; height: 88px; }
          .venue-info { width: 100%; }
          .venue-info h1 { max-width: 100%; }
          .venue-badges { justify-content: center; }
          .venue-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; width: 100%; }
          .venue-capacity-row { max-width: 100%; }
          .venue-hero-actions { width: 100%; justify-content: center; }
          .venue-hero-actions > * { flex: 1; min-width: 0; }
          .venue-content { padding: 0 20px; }
          .venue-tabs { gap: 0; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
          .venue-tabs::-webkit-scrollbar { display: none; }
          .venue-tab { flex: 1; min-width: max-content; text-align: center; padding: 12px 14px; min-height: 44px; display: flex; align-items: center; justify-content: center; }
        }
      `}</style>
    </div>
  );
}
