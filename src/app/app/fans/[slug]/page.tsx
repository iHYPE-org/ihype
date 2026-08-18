import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { HypeButton } from '@/components/HypeButton';
import { FollowButton } from '@/components/FollowButton';
import { ShareButton } from '@/components/ShareButton';
import { PromoteShareButton } from '@/components/PromoteShareButton';
import { getPinnedStatValues } from '@/lib/profile-stats';
import { PinnedStatTiles } from '@/components/PinnedStatTiles';
import { canManageOwnedResource } from '@/lib/permissions';
import { resolveProfileThemeVars } from '@/lib/profile-design';
import { getDemoShowRelationExclusion, isDemoUser, shouldHideDemoContent } from '@/lib/runtime-flags';
import { getPromoterDashboard } from '@/lib/promoterDashboard';
import { formatCurrencyFromCents } from '@/lib/ticketing';
import { getBaseUrl } from '@/lib/utils';
import { getServerT } from '@/lib/i18n/server';

export const revalidate = 60;

const fanSections = ['taste', 'top5', 'shows', 'referrals'] as const;
type FanSection = (typeof fanSections)[number];

function getActiveSection(section: string | string[] | undefined): FanSection {
  if (typeof section === 'string' && fanSections.includes(section as FanSection)) return section as FanSection;
  return 'taste';
}

const SECTION_LABEL: Record<FanSection, string> = { taste: 'Taste', top5: 'Top 5', shows: 'Shows', referrals: 'Referrals' };
const SECTION_LABEL_KEY: Record<FanSection, string> = {
  taste: 'fansSlugPage.tabTaste',
  top5: 'fansSlugPage.tabTop5',
  shows: 'fansSlugPage.tabShows',
  referrals: 'fansSlugPage.tabReferrals',
};

function getTopFiveItems(content: string | null) {
  if (!content) return [];
  return content
    .split(/\r?\n|,/)
    .map((entry) => entry.replace(/^\s*[-*\d.]+\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 5);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await db.profile.findUnique({
    where: { slug },
    select: { name: true, genres: true, city: true, stateRegion: true, hypeCount: true },
  });
  if (!profile) return { title: 'Fan · iHYPE' };
  const loc = [profile.city, profile.stateRegion].filter(Boolean).join(', ');
  return {
    title: `${profile.name} · iHYPE`,
    description: ['Fan', profile.genres.slice(0, 3).join(', ') || null, loc || null].filter(Boolean).join(' · '),
  };
}

export default async function FanProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ section?: string | string[] }>;
}) {
  const t = await getServerT();
  const session = await auth();
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeSection = getActiveSection(resolvedSearchParams.section);

  const profile = await db.profile.findUnique({
    where: { slug },
    include: {
      owner: { select: { email: true, username: true } },
      _count: { select: { followers: true } },
    },
  });
  if (!profile || profile.type !== 'LISTENER') return notFound();
  if (shouldHideDemoContent() && isDemoUser(profile.owner)) return notFound();

  const isOwner = canManageOwnedResource(session, profile.ownerId);
  const themeVars = resolveProfileThemeVars(profile);

  const [hypedShows, userHype, promoterDashboard] = await Promise.all([
    db.hypeEvent.findMany({
      where: { userId: profile.ownerId, ...getDemoShowRelationExclusion() },
      include: { show: { include: { venueProfile: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    session?.user?.id
      ? db.profileHypeEvent.findUnique({ where: { userId_profileId: { userId: session.user.id, profileId: profile.id } }, select: { createdAt: true } })
      : null,
    isOwner ? getPromoterDashboard(profile.ownerId) : Promise.resolve(null),
  ]);

  const now = new Date();
  const shows = hypedShows.map((entry) => entry.show);
  const upcomingShows = shows.filter((show) => show.status === 'LIVE' || show.startsAt >= now);
  const topFiveItems = getTopFiveItems(profile.topFiveContent);
  const baseUrl = getBaseUrl();
  const pinnedStats = await getPinnedStatValues(profile.id, profile.type, profile.pinnedStats);

  return (
    <div className="fan-page" style={(themeVars ?? undefined) as React.CSSProperties | undefined}>
      <div className="fan-hero">
        <div className="fan-hero-row">
          <div className="fan-avatar">
            {profile.avatarImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={profile.name} src={profile.avatarImage} fetchPriority="high" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            ) : (
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.625rem' }}>{profile.name.charAt(0)}</span>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div className="fan-display-name">{profile.name}</div>
            <div className="fan-handle">{profile.owner?.username ? `@${profile.owner.username}` : profile.hexId}{profile.city ? ` · ${profile.city}` : ''}</div>
            <div className="fan-hero-badges">
              <span className="fan-badge" style={{ background: 'rgba(var(--role-fan-rgb),.15)', color: 'var(--role-fan)' }}>{t('fansSlugPage.fanBadge', 'Fan')}</span>
              {profile.verificationStatus === 'VERIFIED' && <span className="fan-badge" style={{ background: 'rgba(var(--role-venue-rgb),.15)', color: 'var(--role-venue)' }}>{t('fansSlugPage.verifiedBadge', '✓ Verified')}</span>}
            </div>
            <div className="fan-hero-actions">
              {isOwner ? (
                <>
                  <Link className="fan-hero-btn" href="/pages">{t('fansSlugPage.editProfile', 'Edit Profile')}</Link>
                  <Link className="fan-hero-btn" href="/settings">{t('fansSlugPage.settings', 'Settings')}</Link>
                </>
              ) : (
                <>
                  <FollowButton profileId={profile.id} variant="hero" />
                  <ShareButton className="fan-hero-btn" label={t('fansSlugPage.shareLabel', 'Share')} path={`/fans/${profile.slug}`} title={profile.name} />
                </>
              )}
            </div>
          </div>
        </div>
        <div className="fan-stats">
          <div><div className="fan-stat-val">{shows.length}</div><div className="fan-stat-label">{t('fansSlugPage.hypesCastLabel', 'Hypes Cast')}</div></div>
          <div><div className="fan-stat-val">{upcomingShows.length}</div><div className="fan-stat-label">{t('fansSlugPage.showsAttendingLabel', 'Shows Attending')}</div></div>
          <div><div className="fan-stat-val">{profile._count.followers.toLocaleString()}</div><div className="fan-stat-label">{t('fansSlugPage.followersLabel', 'Followers')}</div></div>
        </div>
        <PinnedStatTiles accent="var(--profile-accent, var(--role-fan))" stats={pinnedStats} />
      </div>

      <div className="fan-content">
        <div className="fan-tabs">
          {fanSections.filter((s) => s !== 'referrals' || isOwner).map((section) => (
            <Link className={section === activeSection ? 'fan-tab active' : 'fan-tab'} href={`/fans/${profile.slug}?section=${section}`} key={section}>
              {t(SECTION_LABEL_KEY[section], SECTION_LABEL[section])}
            </Link>
          ))}
        </div>

        {activeSection === 'taste' && (
          profile.genres.length === 0 ? (
            <div className="fan-empty"><p>{t('fansSlugPage.noTasteData', 'No taste data yet.')}</p></div>
          ) : (
            <div className="fan-chip-row">
              {profile.genres.map((g) => <span className="fan-chip" key={g}>{g}</span>)}
            </div>
          )
        )}

        {activeSection === 'top5' && (
          topFiveItems.length === 0 ? (
            <div className="fan-empty"><p>{t('fansSlugPage.noTop5List', 'No top 5 list yet.')}</p></div>
          ) : (
            <ol className="fan-top5-list">
              {topFiveItems.map((item, i) => (
                <li className="fan-top5-row" key={item}>
                  <span className="fan-top5-rank">{i + 1}</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          )
        )}

        {activeSection === 'shows' && (
          upcomingShows.length === 0 ? (
            <div className="fan-empty"><p>{t('fansSlugPage.noUpcomingShows', 'No upcoming shows.')} <Link href="/app/map?layer=events" style={{ color: 'var(--accent)' }}>{t('fansSlugPage.browseEvents', 'Browse events →')}</Link></p></div>
          ) : (
            <div className="fan-show-list">
              {upcomingShows.map((show) => (
                <Link className="fan-show-row" href={`/shows/${show.slug}`} key={show.id}>
                  <div>
                    <h4>{show.title}</h4>
                    <p>{show.startsAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}{show.venueProfile?.city ? ` · ${show.venueProfile.city}` : ''}</p>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--profile-accent, var(--role-fan))', fontWeight: 600 }}>{t('fansSlugPage.hypedBadge', 'Hyped ✓')}</span>
                </Link>
              ))}
            </div>
          )
        )}

        {activeSection === 'referrals' && isOwner && promoterDashboard && (
          <div>
            {promoterDashboard.refHexId && (
              <div className="fan-ref-box">
                <div className="fan-ref-label">{t('fansSlugPage.referralLinkLabel', 'Referral Link')}</div>
                <div className="fan-ref-url">{`${baseUrl}/h/${promoterDashboard.refHexId}`}</div>
                <PromoteShareButton link={`${baseUrl}/h/${promoterDashboard.refHexId}`} slug="referral" title="iHYPE" />
                <p style={{ fontSize: '0.75rem', color: 'var(--ink-a50)', marginTop: 12 }}>
                  {t('fansSlugPage.referralExplainer', 'Earn a proportional share of the 10% promoter pool for every ticket your link drives.')}
                </p>
              </div>
            )}
            {promoterDashboard.earnedCents === 0 ? (
              <div className="fan-empty"><p>{t('fansSlugPage.noEarningsYet', 'No earnings yet — share your link!')}</p></div>
            ) : (
              <div className="fan-payout-list">
                <div className="fan-payout-row">
                  <span>{t('fansSlugPage.totalEarnedLabel', 'Total earned (pending settlement)')}</span>
                  <span style={{ fontWeight: 700, color: 'var(--profile-accent, var(--role-fan))' }}>{formatCurrencyFromCents(promoterDashboard.earnedCents)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: '0 32px' }}>
        <HypeButton entityLabel={t('fansSlugPage.hypeEntityLabel', 'fan page')} initialCount={profile.hypeCount} lastHypedAt={userHype?.createdAt.toISOString() ?? null} targetId={profile.id} targetType="profile" />
      </div>

      <style>{`
        .fan-page { max-width: 640px; margin: 0 auto; padding: 32px 0 100px; }
        .fan-hero { padding: 40px 32px 32px; background: var(--profile-hero, transparent); border-bottom: 1px solid var(--profile-border, transparent); }
        .fan-hero-row { display: flex; gap: 32px; align-items: flex-start; flex-wrap: wrap; }
        @media (max-width: 600px) { .fan-hero { padding: 24px 20px; } .fan-content { padding: 0 20px; } }
        .fan-avatar { width: 96px; height: 96px; border-radius: 50%; background: var(--profile-hero, linear-gradient(135deg,var(--role-fan),var(--accent-2))); flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: var(--ink-on-accent); overflow: hidden; }
        .fan-display-name { font-family: var(--profile-font-display, var(--font-display)); font-size: 32px; font-weight: 800; letter-spacing: -.02em; margin-bottom: 6px; color: var(--ink); }
        .fan-handle { font-family: var(--font-mono); font-size: 12px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-a50); margin-bottom: 12px; }
        .fan-hero-badges { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
        .fan-badge { display: inline-block; padding: 5px 12px; border-radius: 4px; font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: .14em; }
        .fan-hero-actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .fan-hero-btn { display: inline-flex; align-items: center; gap: 7px; padding: 10px 18px; border-radius: 9px; font-size: 13px; font-weight: 700; text-decoration: none; background: var(--line); color: var(--ink); border: 1px solid var(--hair-100); }
        .fan-hero-btn:hover { background: var(--hair-100); }
        .fan-stats { display: flex; gap: 32px; margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--line); flex-wrap: wrap; }
        .fan-stat-val { font-size: 22px; font-weight: 700; color: var(--profile-accent, var(--role-fan)); font-family: var(--profile-font-display, var(--font-display)); }
        .fan-stat-label { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-a55); margin-top: 2px; }
        .fan-content { padding: 0 32px; }
        .fan-tabs { display: flex; gap: 24px; border-bottom: 1px solid var(--line); margin: 28px 0; flex-wrap: wrap; }
        .fan-tab { padding: 10px 0; border-bottom: 2px solid transparent; cursor: pointer; font-weight: 600; font-size: 14px; color: var(--ink-a60); text-decoration: none; }
        .fan-tab.active { color: var(--ink); border-color: var(--profile-accent, var(--role-fan)); }
        .fan-chip-row { display: flex; gap: 10px; flex-wrap: wrap; }
        .fan-chip { padding: 8px 16px; border-radius: 9999px; background: rgba(var(--role-fan-rgb),.1); border: 1px solid rgba(var(--role-fan-rgb),.25); color: var(--profile-accent, var(--role-fan)); font-size: 13px; font-weight: 600; }
        .fan-top5-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; }
        .fan-top5-row { display: flex; gap: 16px; align-items: center; padding: 14px 16px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg2); color: var(--ink); }
        .fan-top5-rank { font-family: var(--font-mono); font-size: 11px; color: var(--ink-a50); width: 20px; text-align: center; flex-shrink: 0; }
        .fan-show-list { display: flex; flex-direction: column; gap: 12px; }
        .fan-show-row { display: flex; justify-content: space-between; align-items: center; padding: 16px 18px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg2); text-decoration: none; color: inherit; }
        .fan-show-row:hover { background: var(--bg3); }
        .fan-show-row h4 { font-family: var(--profile-font-display, var(--font-display)); font-size: 14px; font-weight: 800; margin-bottom: 2px; color: var(--ink); }
        .fan-show-row p { font-size: 12px; color: var(--ink-a55); }
        .fan-ref-box { background: rgba(var(--role-fan-rgb),.06); border: 1px solid rgba(var(--role-fan-rgb),.2); border-radius: 10px; padding: 24px; margin-bottom: 24px; }
        .fan-ref-label { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: .14em; color: var(--profile-accent, var(--role-fan)); margin-bottom: 10px; }
        .fan-ref-url { font-family: var(--font-mono); font-size: 13px; background: var(--bg); border: 1px solid var(--hair-100); border-radius: 6px; padding: 10px 14px; margin-bottom: 12px; word-break: break-all; color: var(--ink); }
        .fan-payout-list { border: 1px solid var(--line); border-radius: 10px; padding: 0 20px; background: var(--bg2); }
        .fan-payout-row { display: flex; justify-content: space-between; padding: 14px 0; font-size: 14px; }
        .fan-empty { text-align: center; padding: 48px 24px; color: var(--ink-a50); }
      `}</style>
    </div>
  );
}
