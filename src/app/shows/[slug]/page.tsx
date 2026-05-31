import type { Metadata } from 'next';
import { cache } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getShowVisibilitySignals } from '@/lib/integrity';
import { isAdminSession } from '@/lib/permissions';
import { detectRequestLocation } from '@/lib/request-location';
import { parseShowProductionPlan } from '@/lib/show-composer';
import { formatShowTime, getBaseUrl } from '@/lib/utils';
import { ShowComments } from '@/components/ShowComments';
import { ShowEngagement } from '@/components/ShowEngagement';
import { ShowSetlistEditor } from '@/components/ShowSetlistEditor';
import { AdBanner } from '@/components/AdBanner';
import { ShowRecapForm } from '@/components/ShowRecapForm';
import { ShowMediaGrid } from './ShowMediaGrid';
import { ShowProductionPlan } from './ShowProductionPlan';
import { ShowTicketing } from './ShowTicketing';
import { ShowTracklist } from './ShowTracklist';

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

  return {
    title,
    description,
    openGraph: {
      type: 'website',
      siteName: 'iHYPE',
      title,
      description,
      url:   `/shows/${slug}`,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card:        'summary_large_image',
      title,
      description,
      ...(image ? { images: [image] } : {}),
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
        ticketOrders: {
          orderBy: { createdAt: 'desc' },
          take: 6,
          include: { tickets: { select: { reassignCount: true } } }
        },
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
          where: { hexId: refHexId, type: 'DJ' },
          select: { id: true, name: true }
        })
      : affiliateId
        ? db.profile.findFirst({
            where: { id: affiliateId, type: 'DJ' },
            select: { id: true, name: true }
          })
        : Promise.resolve(null)
  ]);

  const visibility = getShowVisibilitySignals(show);
  const productionPlan = parseShowProductionPlan(show.productionPlan);

  // Ticketed shows require a signed playback token; public shows use the raw HLS URL.
  // Token signing only activates when MUX_SIGNING_KEY_ID + MUX_SIGNING_PRIVATE_KEY are set.
  const hasTicket = session?.user?.id
    ? await db.ticket.findFirst({
        where: { showId: show.id, holderEmail: (await db.user.findUnique({ where: { id: session.user.id }, select: { email: true } }))?.email ?? '' },
        select: { id: true }
      }).then(Boolean)
    : false;

  const canWatch = !show.isTicketed || hasTicket || (session?.user?.id === show.creatorId) || isAdminSession(session);

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

  const userShowHype = session?.user?.id
    ? await db.hypeEvent.findUnique({ where: { userId_showId: { userId: session.user.id, showId: show.id } }, select: { userId: true } })
    : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="container section">
        <div className="profile-header">
          <div className="badge">{show.status}</div>
          <h1 className="title" style={{ fontSize: '2.7rem' }}>
            {show.title}
          </h1>
          <p className="subtitle">{show.description}</p>
          <p className="meta">
            {formatShowTime(show.startsAt)}
            {show.venueProfile ? ` | ${show.venueProfile.name}` : ''}
            {show.headlinerProfile ? ` | ${show.headlinerProfile.name}` : ''}
          </p>
          <div style={{ marginTop: 10 }}>
            <a className="button small secondary" href={`/shows/${slug}/poster?download=1`} download style={{ marginBottom: 8, display: 'inline-block' }}>
              Download poster
            </a>
            <ShowEngagement
              showId={show.id}
              canRsvp={Boolean(session?.user?.id)}
              initialCount={rsvpCount}
              initialGoing={viewerGoing}
              canRemind={Boolean(session?.user?.id)}
              initialReminded={false}
              showEnded={show.status === 'ENDED'}
            />
          </div>
        </div>

        <ShowMediaGrid
          productionPlan={productionPlan}
          show={show}
          userShowHype={userShowHype}
          visibility={visibility}
        />

        {productionPlan ? (
          <ShowProductionPlan productionPlan={productionPlan} />
        ) : null}

        <ShowTicketing
          affiliatePromoter={affiliatePromoter}
          currentFan={currentFan}
          show={show}
          viewerLocation={viewerLocation}
        />

        {show.isRadioShow && show.radioTracks.length > 0 ? (
          <ShowTracklist tracks={show.radioTracks} />
        ) : null}

        {setlistTracks.length ? (
          <section className="section">
            <div className="panel" style={{ padding: '1rem 1.25rem' }}>
              <h2 style={{ marginTop: 0 }}>Setlist</h2>
              <ol style={{ paddingLeft: '1.2rem', lineHeight: 1.7, margin: 0 }}>
                {setlistTracks.map((t, i) => <li key={i}>{t}</li>)}
              </ol>
            </div>
          </section>
        ) : null}
        {isShowOwner ? <ShowSetlistEditor showId={show.id} initialTracks={setlistTracks} /> : null}

        {/* Who's going is now embedded in ShowEngagement above */}
        {show.recapText && (
          <section className="section">
            <div className="panel" style={{ padding: '1.25rem' }}>
              <h2>Show recap</h2>
              <p style={{ whiteSpace: 'pre-wrap' }}>{show.recapText}</p>
            </div>
          </section>
        )}
        {isShowOwner && show.status === 'ENDED' && (
          <section className="section">
            <div className="panel" style={{ padding: '1.25rem' }}>
              <h2 style={{ marginTop: 0 }}>Write a recap</h2>
              <ShowRecapForm showId={show.id} initialRecap={show.recapText} />
            </div>
          </section>
        )}
        <ShowComments showId={show.id} canPost={Boolean(session?.user?.id)} />
        <div style={{ marginTop: 24 }}>
          <AdBanner />
        </div>
      </main>
    </>
  );
}
