import type { Metadata } from 'next';
import { cache } from 'react';
import { getServerT } from '@/lib/i18n/server';

export const revalidate = 30;
import Image from 'next/image';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { notFound } from 'next/navigation';
import { HypeButton } from '@/components/HypeButton';
import { ReferralClickTracker } from '@/components/ReferralClickTracker';
import { ReportButton } from '@/components/ReportButton';
import { ShareButton } from '@/components/ShareButton';
import { ShowSequencePlayer } from '@/components/ShowSequencePlayer';
import { TicketSaleCard } from '@/components/TicketSaleCard';
import { db } from '@/lib/db';
import { getShowVisibilitySignals } from '@/lib/integrity';
import { toSafeJsonLdString } from '@/lib/safe-json-ld';
import { isAdminSession } from '@/lib/permissions';
import { detectRequestLocation } from '@/lib/request-location';
import { parseShowProductionPlan } from '@/lib/show-composer';
import { canViewerAccessShowMedia, protectShowProductionPlan } from '@/lib/show-media-access';
import { isPaymentProcessingConfigured } from '@/lib/payments';
import { formatCurrencyFromCents } from '@/lib/ticketing';
import { formatShowTime, getBaseUrl } from '@/lib/utils';

import { ShowEngagement } from '@/components/ShowEngagement';
import { ShowSetlistVote } from '@/components/ShowSetlistVote';
import { ShowSetlistEditor } from '@/components/ShowSetlistEditor';
import { ShowRecapForm } from '@/components/ShowRecapForm';
import { ShowTabs } from '@/components/ShowTabs';
import { ShowComments } from '@/components/ShowComments';

const getShowMeta = cache((slug: string) =>
  db.show.findUnique({
    where: { slug },
    select: {
      title: true,
      description: true,
      status: true,
      isRadioShow: true,
      startsAt: true,
      posterImage: true,
      hypeCount: true,
      venueProfile:     { select: { name: true, city: true, stateRegion: true } },
      headlinerProfile: { select: { name: true } },
    }
  })
);

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const show = await getShowMeta(slug);

  if (!show) return { title: 'Show · iHYPE' };

  const dateStr = show.startsAt
    ? new Date(show.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  const venueName = show.venueProfile?.name ?? null;
  const venueCity = [show.venueProfile?.city, show.venueProfile?.stateRegion].filter(Boolean).join(', ') || null;
  const headliner = show.headlinerProfile?.name ?? null;

  const descParts = [
    show.isRadioShow ? 'Radio show' : (dateStr ?? null),
    venueName ?? null,
    venueCity ?? null,
    headliner ? `Featuring ${headliner}` : null,
    show.hypeCount ? `${show.hypeCount} HYPE` : null,
    show.description?.slice(0, 120) ?? null,
  ].filter(Boolean);

  const title       = `${show.title} · iHYPE`;
  const description = descParts.join(' · ') || 'Live show on iHYPE';
  const image       = show.posterImage ?? undefined;

  const ogParams = new URLSearchParams({
    title: show.title,
    subtitle: [venueName, venueCity].filter(Boolean).join(' · ') || description,
    type: 'show',
    ...(headliner ? { kicker: `Featuring ${headliner}` } : {}),
  });
  const ogImage = `/api/og?${ogParams.toString()}`;

  return {
    title,
    description,
    openGraph: {
      type: 'website',
      siteName: 'iHYPE',
      title,
      description,
      url:   `/shows/${slug}`,
      images: image ? [{ url: image }] : [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card:        'summary_large_image',
      title,
      description,
      images: image ? [image] : [ogImage],
    },
  };
}

export default async function ShowDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ affiliate?: string | string[]; ref?: string | string[] }>;
}) {
  const session = await auth();
  const t = await getServerT();
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const affiliateId =
    typeof resolvedSearchParams.affiliate === 'string' ? resolvedSearchParams.affiliate : undefined;
  const refHexId =
    typeof resolvedSearchParams.ref === 'string' ? resolvedSearchParams.ref : undefined;
  const getShowPage = cache((s: string) =>
    db.show.findUnique({
      where: { slug: s },
      include: {
        venueProfile: true,
        headlinerProfile: true,
        promoterProfile: true,
        radioTracks: {
          orderBy: { position: 'asc' },
          select: { id: true, position: true, title: true, artistName: true, externalUrl: true, durationSecs: true, blockLabel: true }
        }
      }
    })
  );
  const show = await getShowPage(slug);

  if (!show) return notFound();
  const canPreviewDraft =
    Boolean(session?.user?.id) &&
    (session?.user?.id === show.creatorId || (session ? isAdminSession(session) : false));
  if (show.status === 'DRAFT' && !canPreviewDraft) {
    return notFound();
  }

  const [viewerLocation, currentFan, affiliatePromoter] = await Promise.all([
    detectRequestLocation(),
    session?.user?.id
      ? db.user.findUnique({
          where: { id: session.user.id },
          select: {
            name: true,
            email: true,
            role: true,
            storedPaymentTokenRef: true,
            storedPaymentTokenBrand: true,
            storedPaymentTokenLast4: true
          }
        })
      : Promise.resolve(null),
    refHexId
      ? db.profile.findFirst({
          where: { hexId: refHexId },
          select: { id: true, name: true }
        })
      : affiliateId
        ? db.profile.findFirst({
            where: { id: affiliateId },
            select: { id: true, name: true }
          })
        : Promise.resolve(null)
  ]);

  const visibility = getShowVisibilitySignals(show);
  const canWatch = await canViewerAccessShowMedia({
    showId: show.id,
    isTicketed: show.isTicketed,
    creatorId: show.creatorId,
    userId: session?.user?.id,
    role: currentFan?.role ?? session?.user?.role,
    email: currentFan?.email ?? session?.user?.email,
  });
  const rawProductionPlan = parseShowProductionPlan(show.productionPlan);
  const productionPlan = canWatch && rawProductionPlan
    ? protectShowProductionPlan(rawProductionPlan, show.id)
    : null;

  const base = getBaseUrl();
  const jsonLd = show.isRadioShow ? {
    '@context': 'https://schema.org',
    '@type': 'RadioEpisode',
    name: show.title,
    url: `${base}/shows/${slug}`,
    ...(show.description ? { description: show.description } : {}),
    ...(show.posterImage ? { image: show.posterImage } : {}),
    ...(show.headlinerProfile ? { byArtist: { '@type': 'MusicGroup', name: show.headlinerProfile.name } } : {}),
  } : {
    '@context': 'https://schema.org',
    '@type': 'MusicEvent',
    name: show.title,
    url: `${base}/shows/${slug}`,
    ...(show.description ? { description: show.description } : {}),
    ...(show.posterImage ? { image: show.posterImage } : {}),
    eventStatus: show.status === 'LIVE' ? 'https://schema.org/EventScheduled'
      : show.status === 'ENDED' ? 'https://schema.org/EventPast'
      : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
    ...(show.startsAt ? { startDate: show.startsAt.toISOString() } : {}),
    ...(show.venueProfile ? {
      location: {
        '@type': 'Place',
        name: show.venueProfile.name,
        address: { '@type': 'PostalAddress', addressLocality: show.venueProfile.city ?? '', addressRegion: show.venueProfile.stateRegion ?? '' },
      },
    } : {}),
    ...(show.headlinerProfile ? { performer: { '@type': 'MusicGroup', name: show.headlinerProfile.name } } : {}),
  };

  // RSVP state (audit-log driven, no schema change).
  const rsvpRows = await db.auditLog.findMany({
    where: { action: 'show_rsvp', entityType: 'show', entityId: show.id },
    orderBy: { createdAt: 'desc' },
    select: { actorUserId: true, metadata: true, createdAt: true }
  });
  const rsvpLatestByUser = new Map<string, 'going' | 'cancelled'>();
  for (const row of rsvpRows) {
    if (!row.actorUserId) continue;
    if (rsvpLatestByUser.has(row.actorUserId)) continue;
    const meta = (row.metadata ?? {}) as { state?: string };
    rsvpLatestByUser.set(row.actorUserId, meta.state === 'cancelled' ? 'cancelled' : 'going');
  }
  let rsvpCount = 0;
  for (const state of rsvpLatestByUser.values()) {
    if (state === 'going') rsvpCount += 1;
  }
  const viewerGoing = session?.user?.id
    ? rsvpLatestByUser.get(session.user.id) === 'going'
    : false;

  // Setlist (audit-log driven, no schema change)
  const setlistLast = await db.auditLog.findFirst({
    where: { action: 'show_setlist', entityType: 'show', entityId: show.id },
    orderBy: { createdAt: 'desc' },
    select: { metadata: true }
  });
  const setlistMeta = (setlistLast?.metadata ?? {}) as { tracks?: unknown };
  const setlistTracks = Array.isArray(setlistMeta.tracks)
    ? (setlistMeta.tracks.filter((t) => typeof t === 'string') as string[])
    : [];
  const isShowOwner = Boolean(session?.user?.id) && session?.user?.id === show.creatorId;

  const recentTicketOrders = isShowOwner || isAdminSession(session)
    ? await db.ticketOrder.findMany({
        where: { showId: show.id },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          status: true,
          totalTaxCents: true,
          quantity: true,
          totalChargeCents: true,
          subtotalCents: true,
          venuePayoutCents: true,
          artistPayoutCents: true,
          promoterPayoutCents: true,
          tickets: { select: { reassignCount: true } },
        },
      })
    : [];

  const userShowHype = session?.user?.id
    ? await db.hypeEvent.findUnique({ where: { userId_showId: { userId: session.user.id, showId: show.id } }, select: { userId: true } })
    : null;

  // Demand sparkline — real ticket-order velocity over the last 12h, bucketed
  // into 8 windows (no fabricated data; all-cold when there's no order signal).
  const DEMAND_WINDOW_MS = 12 * 60 * 60 * 1000;
  const DEMAND_BUCKETS = 8;
  const demandWindowStart = new Date(Date.now() - DEMAND_WINDOW_MS);
  const demandOrders = show.isTicketed
    ? await db.ticketOrder.findMany({
        where: { showId: show.id, createdAt: { gte: demandWindowStart }, status: { not: 'VOID' } },
        select: { createdAt: true, quantity: true },
      })
    : [];
  const demandBucketMs = DEMAND_WINDOW_MS / DEMAND_BUCKETS;
  const demandBucketValues = Array.from({ length: DEMAND_BUCKETS }, () => 0);
  for (const order of demandOrders) {
    const idx = Math.min(
      DEMAND_BUCKETS - 1,
      Math.max(0, Math.floor((order.createdAt.getTime() - demandWindowStart.getTime()) / demandBucketMs))
    );
    demandBucketValues[idx] += order.quantity;
  }
  const demandMax = Math.max(...demandBucketValues, 0);
  const demandSpark = demandBucketValues.map((value) => {
    const frac = demandMax > 0 ? value / demandMax : 0;
    return {
      isCold: demandMax === 0 || frac < 0.3,
      isWarm: demandMax > 0 && frac >= 0.3 && frac < 0.6,
      isHot: demandMax > 0 && frac >= 0.6 && frac < 0.85,
      isFire: demandMax > 0 && frac >= 0.85,
    };
  });
  const demandLatest = demandSpark[demandSpark.length - 1];
  const demandLabel = demandMax === 0 ? 'Cold' : demandLatest.isFire ? 'Fire' : demandLatest.isHot ? 'Hot' : demandLatest.isWarm ? 'Warm' : 'Cold';
  const demandLabelColor = demandLabel === 'Fire' ? '#ff1f3d' : demandLabel === 'Hot' ? 'var(--accent)' : demandLabel === 'Warm' ? '#ffb84a' : 'var(--ink-a50)';

  // Venue comps — real sibling shows at the same venue, ranked by hype count
  // (no fabricated demand numbers; falls back to an empty list when the venue
  // has no other ticketed shows yet).
  const venueComps = show.isTicketed && show.venueProfileId
    ? await (async () => {
        const siblings = await db.show.findMany({
          where: {
            venueProfileId: show.venueProfileId,
            isTicketed: true,
            id: { not: show.id },
            status: { in: ['SCHEDULED', 'LIVE', 'ENDED'] },
          },
          orderBy: { hypeCount: 'desc' },
          take: 3,
          select: { id: true, title: true, hypeCount: true },
        });
        const combined = [
          { id: show.id, title: `${show.title} (this show)`, hypeCount: show.hypeCount, isCurrent: true },
          ...siblings.map((s) => ({ ...s, isCurrent: false })),
        ].sort((a, b) => b.hypeCount - a.hypeCount);
        const tiers = ['isFire', 'isHot', 'isWarm', 'isCold'] as const;
        return combined.map((c, i) => {
          const tier = tiers[Math.min(i, tiers.length - 1)];
          return {
            id: c.id,
            title: c.title,
            isCurrent: c.isCurrent,
            isFire: tier === 'isFire',
            isHot: tier === 'isHot',
            isWarm: tier === 'isWarm',
            isCold: tier === 'isCold',
          };
        });
      })()
    : [];

  const date = show.startsAt ? new Date(show.startsAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : null;
  const time = show.startsAt ? new Date(show.startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null;
  const price = show.isTicketed ? show.ticketPriceCents / 100 : 0;
  const sold  = show.ticketsSoldCount || 0;
  const cap   = show.ticketCapacity ?? null;
  const pct   = cap ? Math.round((sold / cap) * 100) : 0;
  const tmFees = (price * 0.27);
  const tmTotal = price + tmFees;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toSafeJsonLdString(jsonLd) }} />
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 100px' }}>
        <ReferralClickTracker ref={refHexId} />

        {/* HERO */}
        <div style={{ background: 'linear-gradient(140deg,rgba(255,80,41,.15),rgba(34,229,212,.08))', border: '1px solid rgba(255,80,41,.2)', borderRadius: 16, padding: 36, marginBottom: 40 }}>
          <div className="video-shell" style={{ marginBottom: 22, borderRadius: 12, overflow: 'hidden' }}>
            {productionPlan ? (
              <ShowSequencePlayer
                autoPlay={show.status === 'LIVE'}
                isPreview={show.status === 'DRAFT'}
                productionPlan={productionPlan}
                showId={show.id}
                showSlug={show.slug}
                title={show.title}
              />
            ) : show.isTicketed && !canWatch ? (
              <div className="empty" style={{ minHeight: 160, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
                <div>
                  <strong>{t('showsSlugPage.ticketRequiredForPlayback', 'Ticket required for playback')}</strong>
                  <p className="meta" style={{ marginTop: 8 }}>
                    {t('showsSlugPage.ticketRequiredForPlaybackBody', 'Sign in with the ticket holder account or purchase a ticket to unlock this show.')}
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ minHeight: 160, position: 'relative', overflow: 'hidden', borderRadius: 12, background: 'var(--hair-40)' }}>
                {show.posterImage
                  ? <Image alt={show.title} src={show.posterImage} fill sizes="(max-width: 768px) 100vw, 50vw" style={{ objectFit: 'cover' }} priority />
                  : <span className="meta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160 }}>{t('showsSlugPage.noAudioUploadedYet', 'No audio uploaded yet')}</span>}
              </div>
            )}
          </div>

          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 12 }}>{show.title}</h1>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20, fontSize: 14, color: 'var(--ink-a75)' }}>
            <span className="badge">{show.status}</span>
            {show.venueProfile && <span className="badge" style={{ color: 'var(--venue)' }}>{t('showsSlugPage.venueBadge', 'Venue')}</span>}
            {show.headlinerProfile && <span className="badge" style={{ color: 'var(--accent)' }}>{t('showsSlugPage.artistBadge', 'Artist')}</span>}
            {date && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="14"><rect height="18" rx="2" width="18" x="3" y="4" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
                {date} · {time}
              </span>
            )}
            {show.venueProfile?.city && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="14"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                {show.venueProfile.city}
              </span>
            )}
            {show.isTicketed && <span>{sold.toLocaleString()} {t('showsSlugPage.ticketsSold', 'tickets sold')}</span>}
          </div>

          {/* A cancelled show used to render as a bare CANCELED badge: both the
              reason and the organizer's note to ticket holders were stored and
              never shown to anyone who came to the page to find out what
              happened. Rendered as plain text — the note is organizer-authored
              free text, normalised server-side, and is never treated as markup. */}
          {show.status === 'CANCELED' && (show.cancellationReason || show.cancellationMessage) && (
            <div style={{ marginBottom: 20, padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,80,41,.25)', background: 'rgba(255,80,41,.06)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 6 }}>
                {t('showsSlugPage.canceledLabel', 'Event cancelled')}
                {show.cancellationReason ? ` · ${show.cancellationReason}` : ''}
              </div>
              {show.cancellationMessage && (
                <p style={{ fontSize: 13, color: 'var(--ink-a75)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                  {show.cancellationMessage}
                </p>
              )}
            </div>
          )}

          <div style={{ marginBottom: 4 }}>
            <a className="button small secondary" download href={`/shows/${slug}/poster?download=1`} style={{ marginBottom: 8, display: 'inline-block' }}>
              {t('showsSlugPage.downloadPoster', 'Download poster')}
            </a>{' '}
            <ShareButton className="button small secondary" path={`/shows/${slug}`} title={show.title} />
            {session?.user?.id ? (
              <ReportButton entityLabel="show" targetId={show.id} targetType="show" />
            ) : null}
            <ShowEngagement
              canRemind={Boolean(session?.user?.id)}
              canRsvp={Boolean(session?.user?.id)}
              initialCount={rsvpCount}
              initialGoing={viewerGoing}
              initialReminded={false}
              showEnded={show.status === 'ENDED'}
              showId={show.id}
            />
          </div>

          {show.status !== 'DRAFT' ? (
            <div style={{ marginTop: 12 }}>
              <HypeButton entityLabel="show" initialCount={show.hypeCount} initiallyHyped={!!userShowHype} targetId={show.id} targetType="show" />
            </div>
          ) : (
            <p className="meta">{t('showsSlugPage.draftPreviewNotice', 'Draft previews stay private until the promoter broadcasts the show live.')}</p>
          )}

          {show.isTicketed && show.venuePayoutPercent !== null && show.artistPayoutPercent !== null && (
            <div style={{ display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden', marginTop: 24 }}>
              <div style={{ flex: Math.max(show.artistPayoutPercent, 1), padding: 16, textAlign: 'center', background: 'rgba(255,80,41,.15)' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>${(price * (show.artistPayoutPercent / 100)).toFixed(2)}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.14em', marginTop: 4, color: 'var(--accent)' }}>{t('showsSlugPage.artistSplitLabel', 'Artist')} · {show.artistPayoutPercent}%</div>
              </div>
              <div style={{ flex: Math.max(show.venuePayoutPercent, 1), padding: 16, textAlign: 'center', background: 'rgba(34,229,212,.15)' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--venue)' }}>${(price * (show.venuePayoutPercent / 100)).toFixed(2)}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.14em', marginTop: 4, color: 'var(--venue)' }}>{t('showsSlugPage.venueSplitLabel', 'Venue')} · {show.venuePayoutPercent}%</div>
              </div>
              {show.promoterPayoutPercent > 0 && (
                <div style={{ flex: Math.max(show.promoterPayoutPercent, 1), padding: 16, textAlign: 'center', background: 'rgba(255,62,154,.15)' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--promoter)' }}>${(price * (show.promoterPayoutPercent / 100)).toFixed(2)}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.14em', marginTop: 4, color: 'var(--promoter)' }}>{t('showsSlugPage.promotersSplitLabel', 'Promoters')} · {show.promoterPayoutPercent}%</div>
                </div>
              )}
            </div>
          )}
        </div>

        {show.status === 'LIVE' && show.headlinerProfileId ? (
          <a
            className="panel"
            href="#setlist-vote"
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              padding: '0.85rem 1.25rem', margin: '0 0 24px', border: '1px solid var(--accent)',
              background: 'rgba(255,80,41,0.12)', textDecoration: 'none', color: 'inherit',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="badge" style={{ color: 'var(--accent)' }}>● LIVE</span>
              <strong>{t('showsSlugPage.liveVoteBanner', 'The show is live — vote on the setlist and shape what plays next.')}</strong>
            </span>
            <span className="button small">{t('showsSlugPage.voteOnSetlist', 'Vote on the setlist')}</span>
          </a>
        ) : null}

        {/* LAYOUT: tabs + sticky ticket box */}
        <div style={{ display: 'grid', gridTemplateColumns: show.isTicketed ? '1fr 300px' : '1fr', gap: 40 }}>
          <ShowTabs
            venueTab={
              <div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ink-a35)', marginBottom: 8 }}>{t('showsSlugPage.venueTabLabel', 'Venue')}</p>
                <p style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: 8 }}>{show.venueProfile?.name ?? t('showsSlugPage.tba', 'TBA')}</p>
                {show.venueProfile && (
                  <p style={{ fontSize: 14, color: 'var(--ink-a70)' }}>
                    {t('showsSlugPage.capacityLabel', 'Capacity')}: {(show.ticketCapacity ?? t('showsSlugPage.openCapacity', 'Open')).toLocaleString?.() ?? show.ticketCapacity ?? t('showsSlugPage.openCapacity', 'Open')} · {show.venueProfile.city}
                  </p>
                )}
                {show.venueProfile?.slug && (
                  <div style={{ marginTop: 16 }}>
                    <Link className="button small secondary" href={`/venues/${show.venueProfile.slug}`}>{t('showsSlugPage.viewVenuePage', 'View Venue Page →')}</Link>
                  </div>
                )}
                {venueComps.length > 0 && (
                  <div style={{ marginTop: 24 }}>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, marginBottom: 4 }}>{t('showsSlugPage.howThisShowComps', 'How this show comps')}</h2>
                    <p className="meta" style={{ marginBottom: 14 }}>{t('showsSlugPage.demandVsOtherShows', 'Demand vs. other shows at')} {show.venueProfile?.name ?? t('showsSlugPage.thisVenue', 'this venue')} {t('showsSlugPage.thisSeason', 'this season.')}</p>
                    {venueComps.map((vc) => (
                      <div key={vc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--hair-80)' }}>
                        <span style={{ flex: 1, fontSize: 14, color: 'var(--ink-a85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vc.title}</span>
                        <div style={{ width: 110, height: 6, borderRadius: 3, background: 'var(--hair-100)', overflow: 'hidden', flexShrink: 0 }}>
                          {vc.isFire && <div style={{ width: '100%', height: '100%', background: '#ff1f3d' }} />}
                          {vc.isHot && <div style={{ width: '70%', height: '100%', background: 'var(--accent)' }} />}
                          {vc.isWarm && <div style={{ width: '45%', height: '100%', background: '#ffb84a' }} />}
                          {vc.isCold && <div style={{ width: '20%', height: '100%', background: 'var(--ink-a35)' }} />}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            }
            lineupTab={
              <div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ink-a35)', marginBottom: 8 }}>{t('showsSlugPage.headlinerLabel', 'Headliner')}</p>
                <p style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: 16 }}>{show.headlinerProfile?.name ?? t('showsSlugPage.tba', 'TBA')}</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ink-a35)', marginBottom: 8 }}>{t('showsSlugPage.promoterLabel', 'Promoter')}</p>
                <p style={{ fontSize: 14 }}>{show.promoterProfile?.name ?? t('showsSlugPage.promoterPoolUnassigned', 'Promoter pool unassigned')}</p>
              </div>
            }
          >
            {/* ABOUT tab content */}
            <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--ink-a85)' }}>
              {show.description || t('showsSlugPage.defaultDescription', 'Presented through iHYPE — face value pricing, zero fees, and every split locked by charter before a single ticket is sold.')}
            </p>

            <div className="panel" style={{ padding: '1.25rem', marginTop: 24 }}>
              <h2>{t('showsSlugPage.showDetails', 'Show details')}</h2>
              <div className="tag-row">
                {show.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
              </div>
              <table className="table">
                <tbody>
                  <tr><th>{t('showsSlugPage.statusLabel', 'Status')}</th><td>{show.status}</td></tr>
                  <tr><th>{t('showsSlugPage.venueTableLabel', 'Venue')}</th><td>{show.venueProfile?.name ?? t('showsSlugPage.tba', 'TBA')}</td></tr>
                  <tr><th>{t('showsSlugPage.headlinerTableLabel', 'Headliner')}</th><td>{show.headlinerProfile?.name ?? t('showsSlugPage.tba', 'TBA')}</td></tr>
                  <tr><th>{t('showsSlugPage.promoterTableLabel', 'Promoter')}</th><td>{show.promoterProfile?.name ?? t('showsSlugPage.promoterPoolUnassigned', 'Promoter pool unassigned')}</td></tr>
                  <tr><th>{t('showsSlugPage.ticketingLabel', 'Ticketing')}</th><td>{show.isTicketed ? t('showsSlugPage.enabled', 'Enabled') : t('showsSlugPage.notEnabled', 'Not enabled')}</td></tr>
                  {show.isTicketed ? (
                    <>
                      <tr><th>{t('showsSlugPage.ticketPriceLabel', 'Ticket price')}</th><td>{formatCurrencyFromCents(show.ticketPriceCents)}</td></tr>
                      <tr><th>{t('showsSlugPage.ticketsSoldLabel', 'Tickets sold')}</th><td>{show.ticketsSoldCount}</td></tr>
                      <tr><th>{t('showsSlugPage.capacityTableLabel', 'Capacity')}</th><td>{show.ticketCapacity ?? t('showsSlugPage.openCapacity', 'Open')}</td></tr>
                      <tr><th>{t('showsSlugPage.grossSalesLabel', 'Gross sales')}</th><td>{formatCurrencyFromCents(show.ticketPriceCents * show.ticketsSoldCount)}</td></tr>
                      <tr><th>{t('showsSlugPage.artistSplitLabel2', 'Artist split')}</th><td>{show.artistPayoutPercent ?? 0}%</td></tr>
                      <tr><th>{t('showsSlugPage.venueSplitLabel2', 'Venue split')}</th><td>{show.venuePayoutPercent ?? 0}%</td></tr>
                      <tr><th>{t('showsSlugPage.promoterPoolLabel', 'Promoter pool')}</th><td>{show.promoterPayoutPercent}%</td></tr>
                      <tr><th>{t('showsSlugPage.eventOpensLabel', 'Event officially opens')}</th><td>{show.ticketingOpensAt ? formatShowTime(show.ticketingOpensAt) : t('showsSlugPage.venueControlled', 'Venue-controlled')}</td></tr>
                    </>
                  ) : null}
                  <tr><th>{t('showsSlugPage.hypeLabel', 'Hype')}</th><td>{show.hypeCount}</td></tr>
                  <tr><th>{t('showsSlugPage.heuristicsLabel', 'Heuristics')}</th><td>{visibility.version}</td></tr>
                </tbody>
              </table>

              <div className="explanation-block">
                <h3>{t('showsSlugPage.whySeeingThis', "Why you're seeing this")}</h3>
                <ul className="launch-list">
                  {visibility.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
              </div>
              {show.bookingLegalNotes ? (
                <div className="explanation-block">
                  <h3>{t('showsSlugPage.legalBookingSnapshot', 'Legal booking snapshot')}</h3>
                  <p>{show.bookingLegalNotes}</p>
                </div>
              ) : null}
            </div>

            {productionPlan ? (
              <div className="panel composer-plan-panel" style={{ marginTop: 24 }}>
                <div className="composer-header">
                  <div>
                    <div className="badge">{t('showsSlugPage.productionPlanBadge', 'Production plan')}</div>
                    <h2>{t('showsSlugPage.promoterRunOfShow', 'Promoter run of show')}</h2>
                    <p className="kicker">
                      {t('showsSlugPage.productionPlanDesc', 'This show was assembled from artist songs and videos, recorded voice-over overdubs, sampler pads, and ad breaks inserted after every three media slots.')}
                    </p>
                  </div>
                </div>

                <div className="composer-grid">
                  <div className="composer-column">
                    <div className="composer-card">
                      <h3>{t('showsSlugPage.artistMedia', 'Artist media')}</h3>
                      {productionPlan.mediaItems.length ? (
                        <div className="composer-library-list">
                          {productionPlan.mediaItems.map((item) => (
                            <div className="composer-media-card" key={item.mediaId}>
                              <div>
                                <div className="composer-media-code">{item.mediaId}</div>
                                <strong>{item.title}</strong>
                                <p className="meta">{item.artistName}{item.notes ? ` | ${item.notes}` : ''}</p>
                              </div>
                              <div className="composer-media-actions">
                                <a className="button small secondary" href={item.url} rel="noreferrer" target="_blank">{t('showsSlugPage.openMedia', 'Open media')}</a>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : <div className="empty">{t('showsSlugPage.noArtistMedia', 'No artist media is attached to this show.')}</div>}
                    </div>
                  </div>

                  <div className="composer-column">
                    <div className="composer-card">
                      <h3>{t('showsSlugPage.voiceOverCues', 'Voice-over cues')}</h3>
                      {productionPlan.voiceOvers.length ? (
                        <div className="composer-voice-list">
                          {productionPlan.voiceOvers.map((voiceCue) => (
                            <div className="composer-voice-card" key={voiceCue.id}>
                              <strong>{voiceCue.title}</strong>
                              <p className="meta">
                                {voiceCue.durationSeconds ? `${voiceCue.durationSeconds}s` : t('showsSlugPage.openDuration', 'Open duration')}
                                {voiceCue.cueAfterMediaId ? ` | cue after ${voiceCue.cueAfterMediaId}` : ''}
                              </p>
                              {voiceCue.script ? <p>{voiceCue.script}</p> : <p className="meta">{t('showsSlugPage.recordedTakeNoNotes', 'Recorded take with no text notes.')}</p>}
                              {voiceCue.recordingDataUrl ? <audio className="composer-audio-preview" controls src={voiceCue.recordingDataUrl} /> : null}
                            </div>
                          ))}
                        </div>
                      ) : <div className="empty">{t('showsSlugPage.noVoiceOverCues', 'No voice-over cues were saved for this show.')}</div>}
                    </div>

                    <div className="composer-card">
                      <h3>{t('showsSlugPage.samplePadAssignments', 'Sample pad assignments')}</h3>
                      {productionPlan.samplePads.length ? (
                        <div className="composer-sample-grid">
                          {productionPlan.samplePads.slice().sort((left, right) => (left.assignedPad ?? 99) - (right.assignedPad ?? 99)).map((sample) => (
                            <div className="composer-sample-card" key={`${sample.sampleId}-${sample.assignedPad ?? 'open'}`}>
                              <div>
                                {sample.assignedPad ? <div className="composer-media-code">{t('showsSlugPage.padLabel', 'Pad')} {String(sample.assignedPad).padStart(2, '0')}</div> : null}
                                <strong>{sample.title}</strong>
                                <p className="meta">{sample.notes ?? t('showsSlugPage.royaltyFreeSample', 'Royalty-free sample.')}</p>
                                <div className="composer-media-code">{sample.sampleId}</div>
                              </div>
                              <a className="button small secondary" href={sample.url}>{t('showsSlugPage.openSample', 'Open sample')}</a>
                            </div>
                          ))}
                        </div>
                      ) : <div className="empty">{t('showsSlugPage.noSamplePads', 'No sample pads were saved for this show.')}</div>}
                    </div>
                  </div>

                  <div className="composer-column">
                    <div className="composer-card">
                      <h3>{t('showsSlugPage.showSequence', 'Show sequence')}</h3>
                      {productionPlan.sequence.length ? (
                        <div className="composer-sequence-list">
                          {productionPlan.sequence.map((item, index) => (
                            <div className="composer-sequence-card" key={item.id}>
                              <div>
                                <span className="composer-sequence-index">{String(index + 1).padStart(2, '0')}</span>
                                <strong>{item.label}</strong>
                              </div>
                              <div className="composer-media-code">{item.kind}</div>
                            </div>
                          ))}
                        </div>
                      ) : <div className="empty">{t('showsSlugPage.noRunOfShowSequence', 'No run-of-show sequence was saved.')}</div>}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {isShowOwner || isAdminSession(session) ? (
              <div className="panel" style={{ padding: '1.25rem', marginTop: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <h2 style={{ margin: 0 }}>{t('showsSlugPage.recentTicketOrderTotals', 'Recent ticket order totals')}</h2>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <Link href={`/payout/${show.slug}`} className="meta">{t('showsSlugPage.fullPayoutBreakdown', 'Full payout breakdown →')}</Link>
                    <Link href={`/shows/${show.slug}/scan`} className="meta">{t('showsSlugPage.scanTicketsAtDoor', 'Scan tickets at the door →')}</Link>
                    {(show.status === 'DRAFT' || show.status === 'SCHEDULED') && (
                      <Link href={`/shows/${show.slug}/cancel`} className="meta" style={{ color: 'var(--accent, #ff5029)' }}>{t('showsSlugPage.cancelEvent', 'Cancel event →')}</Link>
                    )}
                  </div>
                </div>
                {recentTicketOrders.length ? (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t('showsSlugPage.orderStatusCol', 'Status')}</th><th>{t('showsSlugPage.orderTaxCol', 'Tax')}</th><th>{t('showsSlugPage.orderQtyCol', 'Qty')}</th><th>{t('showsSlugPage.orderTotalCol', 'Total')}</th><th>{t('showsSlugPage.orderVenueCol', 'Venue')}</th><th>{t('showsSlugPage.orderArtistCol', 'Artist')}</th><th>{t('showsSlugPage.orderPromoterCol', 'Promoter')}</th>
                        <th title={t('showsSlugPage.passedColTitle', 'Total reassignments across all tickets in this order')}>{t('showsSlugPage.passedCol', 'Passed')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTicketOrders.map((order) => {
                        const totalPassed = order.tickets.reduce((sum, ticket) => sum + ticket.reassignCount, 0);
                        return (
                          <tr key={order.id}>
                            <td>{order.status}</td>
                            <td>{formatCurrencyFromCents(order.totalTaxCents)}</td>
                            <td>{order.quantity}</td>
                            <td>{formatCurrencyFromCents(order.totalChargeCents || order.subtotalCents)}</td>
                            <td>{formatCurrencyFromCents(order.venuePayoutCents)}</td>
                            <td>{formatCurrencyFromCents(order.artistPayoutCents)}</td>
                            <td>{formatCurrencyFromCents(order.promoterPayoutCents)}</td>
                            <td style={totalPassed > 0 ? { color: 'var(--accent-3)', fontWeight: 600 } : { color: 'var(--muted)' }}>
                              {totalPassed > 0 ? `${totalPassed}×` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p className="meta">{t('showsSlugPage.noTicketOrdersYet', 'No ticket orders yet.')}</p>
                )}

                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--hair-80)', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                  <img
                    alt={t('showsSlugPage.doorCheckinQrAlt', 'Door check-in QR code for this show')}
                    src={`/api/shows/${show.id}/qr`}
                    style={{ width: 96, height: 96, background: '#fff', borderRadius: 8, padding: 6 }}
                  />
                  <div>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ink-a50)', marginBottom: 4 }}>
                      {t('showsSlugPage.showDoorQr', 'Show door QR')}
                    </p>
                    <p className="meta" style={{ margin: 0, marginBottom: 8 }}>
                      {t('showsSlugPage.scanOrPrintForDoorStaff', "Scan or print for door staff — links straight to this show's public page.")}
                    </p>
                    <a className="button small secondary" download href={`/api/shows/${show.id}/qr`}>
                      {t('showsSlugPage.downloadQrSvg', 'Download QR (SVG)')}
                    </a>
                  </div>
                </div>
              </div>
            ) : null}

            <ShowComments canComment={Boolean(session?.user?.id)} showId={show.id} />

            {show.isTicketed && canWatch && currentFan?.role === 'FAN' && (
              <div className="panel" style={{ padding: '1.25rem', marginTop: 24 }}>
                <h2>{t('showsSlugPage.transferYourTicket', 'Transfer your ticket')}</h2>
                <p className="subtitle" style={{ marginBottom: '1rem' }}>{t('showsSlugPage.transferTicketDesc', "Can't make it? You can transfer your ticket to a friend without a fee.")}</p>
                <p className="meta">{t('showsSlugPage.useSecureLinkPrefix', 'Use the secure link in your ticket email, or go to')} <Link href="/home">{t('showsSlugPage.yourDashboard', 'your dashboard')}</Link> {t('showsSlugPage.toManageOrders', 'to manage your orders.')}</p>
              </div>
            )}


            {show.isRadioShow && show.radioTracks.length > 0 && (() => {
              const totalSecs = show.radioTracks.reduce((sum, t) => sum + (t.durationSecs ?? 0), 0);
              const totalDuration = totalSecs > 0
                ? `${Math.floor(totalSecs / 3600) > 0 ? `${Math.floor(totalSecs / 3600)}h ` : ''}${Math.floor((totalSecs % 3600) / 60)}m`
                : null;
              const blocks: { label: string | null; tracks: typeof show.radioTracks }[] = [];
              for (const track of show.radioTracks) {
                const last = blocks[blocks.length - 1];
                if (last && last.label === (track.blockLabel ?? null)) last.tracks.push(track);
                else blocks.push({ label: track.blockLabel ?? null, tracks: [track] });
              }
              return (
                <div className="panel" style={{ padding: '1.25rem', marginTop: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ margin: 0 }}>{t('showsSlugPage.tracklist', 'Tracklist')}</h2>
                    {totalDuration && <span className="meta">{show.radioTracks.length} {t('showsSlugPage.tracksCount', 'tracks')} · {totalDuration}</span>}
                  </div>
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {blocks.map((block, bi) => (
                      <div key={bi}>
                        {block.label && (
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.4rem', paddingLeft: '0.75rem' }}>
                            {block.label}
                          </div>
                        )}
                        <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '0.35rem' }}>
                          {block.tracks.map((track) => (
                            <li key={track.id} style={{ display: 'grid', gridTemplateColumns: '2rem 1fr auto', gap: '0.75rem', alignItems: 'center', padding: '0.6rem 0.75rem', borderRadius: '10px', background: 'var(--hair-30)' }}>
                              <span className="meta" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{String(track.position + 1).padStart(2, '0')}</span>
                              <div>
                                <strong style={{ display: 'block' }}>{track.title}</strong>
                                {track.artistName && <span className="meta">{track.artistName}</span>}
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                {track.durationSecs && (
                                  <span className="meta" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                    {Math.floor(track.durationSecs / 60)}:{String(track.durationSecs % 60).padStart(2, '0')}
                                  </span>
                                )}
                                {track.externalUrl && (
                                  <a className="button small secondary" href={track.externalUrl} rel="noreferrer" style={{ fontSize: '0.75rem' }} target="_blank">{t('showsSlugPage.playTrack', 'Play ↗')}</a>
                                )}
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {setlistTracks.length ? (
              <div className="panel" style={{ padding: '1rem 1.25rem', marginTop: 24 }}>
                <h2 style={{ marginTop: 0 }}>{t('showsSlugPage.setlist', 'Setlist')}</h2>
                <ol style={{ paddingLeft: '1.2rem', lineHeight: 1.7, margin: 0 }}>
                  {setlistTracks.map((t, i) => <li key={i}>{t}</li>)}
                </ol>
              </div>
            ) : null}
            {isShowOwner ? <ShowSetlistEditor initialTracks={setlistTracks} showId={show.id} /> : null}

            {['SCHEDULED', 'LIVE'].includes(show.status) && show.headlinerProfileId ? (
              <ShowSetlistVote canVote={Boolean(session?.user?.id)} isLive={show.status === 'LIVE'} showId={show.id} />
            ) : null}

            {show.recapText && (
              <div className="panel" style={{ padding: '1.25rem', marginTop: 24 }}>
                <h2>{t('showsSlugPage.showRecap', 'Show recap')}</h2>
                <p style={{ whiteSpace: 'pre-wrap' }}>{show.recapText}</p>
              </div>
            )}
            {isShowOwner && show.status === 'ENDED' && (
              <div className="panel" style={{ padding: '1.25rem', marginTop: 24 }}>
                <h2 style={{ marginTop: 0 }}>{t('showsSlugPage.writeARecap', 'Write a recap')}</h2>
                <ShowRecapForm initialRecap={show.recapText} showId={show.id} />
              </div>
            )}
          </ShowTabs>

          {/* TICKET BOX */}
          {show.isTicketed && show.venueProfile && show.headlinerProfile && show.venuePayoutPercent !== null && show.artistPayoutPercent !== null ? (
            <aside style={{ border: '1px solid var(--hair-80)', borderRadius: 12, padding: 28, background: 'var(--bg2)', position: 'sticky', top: 80, alignSelf: 'flex-start' }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--accent)', marginBottom: 4, fontFamily: 'var(--font-display)' }}>${price.toFixed(2)}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', color: 'var(--ink-a50)', marginBottom: 20 }}>{t('showsSlugPage.zeroFeesFaceValueOnly', '$0 fees · face value only')}</div>

              {cap !== null && (
                <>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--hair-100)', margin: '16px 0', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: 'var(--accent)', width: `${pct}%` }} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-a60)', marginBottom: 16 }}>{sold} / {cap} {t('showsSlugPage.soldLabel', 'sold')} · {cap - sold} {t('showsSlugPage.remainingLabel', 'remaining')}</div>
                </>
              )}

              <div style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-a40)' }}>{t('showsSlugPage.demandLast12h', 'Demand — last 12h')}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: demandLabelColor }}>
                    {demandLabel === 'Fire' ? t('showsSlugPage.fireEmojiLabel', '🔥 Fire') : demandLabel}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 26 }}>
                  {demandSpark.map((bar, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        borderRadius: 2,
                        height: bar.isFire ? '100%' : bar.isHot ? '70%' : bar.isWarm ? '45%' : '25%',
                        background: bar.isFire ? '#ff1f3d' : bar.isHot ? 'var(--accent)' : bar.isWarm ? '#ffb84a' : 'var(--ink-a35)',
                      }}
                    />
                  ))}
                </div>
              </div>

              {!isPaymentProcessingConfigured() ? (
                <div style={{ border: '1px solid rgba(34,229,212,.3)', borderRadius: 10, padding: 16, background: 'rgba(34,229,212,.06)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.14em', color: 'var(--venue)', marginBottom: 8 }}>
                    {t('showsSlugPage.paidTicketsComingSoon', 'Paid tickets · Coming soon')}
                  </div>
                  <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink-a80)', margin: 0 }}>
                    {t('showsSlugPage.ticketSalesNotOpenNotice', "Ticket sales haven't opened on iHYPE yet. RSVP free above to hold your spot — we'll remind you before the show, and face-value pricing with the locked 70/20/10 split kicks in the moment sales open.")}
                  </p>
                </div>
              ) : (
              <TicketSaleCard
                affiliatePromoterName={affiliatePromoter?.name ?? null}
                affiliatePromoterProfileId={affiliatePromoter?.id ?? null}
                artistName={show.headlinerProfile.name}
                artistPayoutPercent={show.artistPayoutPercent}
                showSlug={slug}
                currentFan={
                  currentFan?.role === 'FAN'
                    ? {
                        name: currentFan.name,
                        email: currentFan.email ?? '',
                        hasStoredPaymentToken: Boolean(currentFan.storedPaymentTokenRef),
                        storedPaymentTokenBrand: currentFan.storedPaymentTokenBrand,
                        storedPaymentTokenLast4: currentFan.storedPaymentTokenLast4
                      }
                    : null
                }
                promoterName={show.promoterProfile?.name ?? null}
                promoterPayoutPercent={show.promoterPayoutPercent}
                showId={show.id}
                ticketCapacity={show.ticketCapacity}
                ticketPriceCents={show.ticketPriceCents}
                ticketingOpen={show.status === 'LIVE' || Boolean(show.ticketingOpensAt && show.ticketingOpensAt <= new Date())}
                ticketingOpensAtLabel={show.ticketingOpensAt ? formatShowTime(show.ticketingOpensAt) : null}
                ticketsSoldCount={show.ticketsSoldCount}
                title={show.title}
                venueName={show.venueProfile.name}
                venueLocation={{
                  postalCode: show.venueProfile.postalCode,
                  stateRegion: show.venueProfile.stateRegion,
                  country: show.venueProfile.country
                }}
                venuePayoutPercent={show.venuePayoutPercent}
                viewerLocation={{
                  city: viewerLocation?.city,
                  stateRegion: viewerLocation?.stateRegion,
                  country: viewerLocation?.country,
                  postalCode: viewerLocation?.postalCode
                }}
              />
              )}

              <div style={{ background: 'var(--hair-40)', borderRadius: 8, padding: 14, marginTop: 16 }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ink-a50)', marginBottom: 10 }}>{t('showsSlugPage.vsTicketmaster', 'vs. Ticketmaster')}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}><span>{t('showsSlugPage.faceValue', 'Face value')}</span><span>${price.toFixed(2)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6, color: 'var(--ink-a50)' }}><span>{t('showsSlugPage.serviceFees27', 'Service fees (27%)')}</span><span>+${tmFees.toFixed(2)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6, color: 'var(--ink-a50)' }}><span>{t('showsSlugPage.tmTotal', 'TM total')}</span><span>${tmTotal.toFixed(2)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: 'var(--venue)' }}><span>{t('showsSlugPage.ihypeTotal', 'iHYPE total')}</span><span>${price.toFixed(2)}</span></div>
              </div>

              <div style={{ marginTop: 16, fontSize: 11, color: 'var(--ink-a50)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.12em', lineHeight: 1.5 }}>
                {t('showsSlugPage.splitLockedByCharter', 'Split locked by charter · iHYPE takes 0%')}
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </>
  );
}
