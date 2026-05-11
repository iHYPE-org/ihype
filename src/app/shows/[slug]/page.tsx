import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { notFound } from 'next/navigation';
import { HypeButton } from '@/components/HypeButton';
import { ShowSequencePlayer } from '@/components/ShowSequencePlayer';
import { TicketSaleCard } from '@/components/TicketSaleCard';
import { db } from '@/lib/db';
import { getShowVisibilitySignals } from '@/lib/integrity';
import { isAdminSession } from '@/lib/permissions';
import { detectRequestLocation } from '@/lib/request-location';
import { parseShowProductionPlan } from '@/lib/show-composer';
import { formatCurrencyFromCents } from '@/lib/ticketing';
import { formatShowTime } from '@/lib/utils';
import { getMuxPlaybackToken } from '@/lib/mux';
import { ShowPlaybackTracker } from '@/components/ShowPlaybackTracker';

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const show = await db.show.findUnique({
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
  });

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
  const show = await db.show.findUnique({
    where: { slug },
    include: {
      venueProfile: true,
      headlinerProfile: true,
      promoterProfile: true,
      ticketOrders: {
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: {
          tickets: {
            select: { reassignCount: true }
          }
        }
      },
      radioTracks: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          position: true,
          title: true,
          artistName: true,
          externalUrl: true,
          durationSecs: true,
          blockLabel: true
        }
      }
    }
  });

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

  let playbackUrl: string | null = null;
  if (show.streamPlaybackId && canWatch) {
    const token = show.isTicketed ? getMuxPlaybackToken(show.streamPlaybackId) : null;
    playbackUrl = token
      ? `https://stream.mux.com/${show.streamPlaybackId}.m3u8?token=${token}`
      : `https://stream.mux.com/${show.streamPlaybackId}.m3u8`;
  }

  return (
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
      </div>

      <div className="grid grid-2">
        <section className="panel" style={{ padding: '1rem' }}>
          <div className="video-shell">
            {playbackUrl ? (
              <ShowPlaybackTracker
                autoPlay={show.status === 'LIVE'}
                isLive={show.status === 'LIVE'}
                playbackUrl={playbackUrl}
                showId={show.id}
                showSlug={show.slug}
                title={show.title}
              />
            ) : productionPlan ? (
              <ShowSequencePlayer
                autoPlay={show.status === 'LIVE'}
                isPreview={show.status === 'DRAFT'}
                productionPlan={productionPlan}
                showId={show.id}
                showSlug={show.slug}
                title={show.title}
              />
            ) : (
              <div className="show-art" style={{ minHeight: 320 }}>
                Connect your stream provider to go live
              </div>
            )}
          </div>
          {show.status !== 'DRAFT' ? (
            <HypeButton entityLabel="show" initialCount={show.hypeCount} targetId={show.id} targetType="show" />
          ) : (
            <p className="meta">Draft previews stay private until the promoter broadcasts the show live.</p>
          )}
        </section>

        <aside className="panel" style={{ padding: '1.25rem' }}>
          <h2>Show details</h2>
          <div className="tag-row">
            {show.tags.map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
          <table className="table">
            <tbody>
              <tr>
                <th>Status</th>
                <td>{show.status}</td>
              </tr>
              <tr>
                <th>Stream provider</th>
                <td>{show.streamProvider ?? 'Not configured'}</td>
              </tr>
              <tr>
                <th>Venue</th>
                <td>{show.venueProfile?.name ?? 'TBA'}</td>
              </tr>
              <tr>
                <th>Headliner</th>
                <td>{show.headlinerProfile?.name ?? 'TBA'}</td>
              </tr>
              <tr>
                <th>Promoter</th>
                <td>{show.promoterProfile?.name ?? 'Promoter pool unassigned'}</td>
              </tr>
              <tr>
                <th>Ticketing</th>
                <td>{show.isTicketed ? 'Enabled' : 'Not enabled'}</td>
              </tr>
              {show.isTicketed ? (
                <>
                  <tr>
                    <th>Ticket price</th>
                    <td>{formatCurrencyFromCents(show.ticketPriceCents)}</td>
                  </tr>
                  <tr>
                    <th>Tickets sold</th>
                    <td>{show.ticketsSoldCount}</td>
                  </tr>
                  <tr>
                    <th>Capacity</th>
                    <td>{show.ticketCapacity ?? 'Open'}</td>
                  </tr>
                  <tr>
                    <th>Gross sales</th>
                    <td>{formatCurrencyFromCents(show.ticketPriceCents * show.ticketsSoldCount)}</td>
                  </tr>
                  <tr>
                    <th>Venue split</th>
                    <td>{show.venuePayoutPercent ?? 0}%</td>
                  </tr>
                  <tr>
                    <th>Artist split</th>
                    <td>{show.artistPayoutPercent ?? 0}%</td>
                  </tr>
                  <tr>
                    <th>Promoter pool</th>
                    <td>{show.promoterPayoutPercent}%</td>
                  </tr>
                  <tr>
                    <th>Event officially opens</th>
                    <td>{show.ticketingOpensAt ? formatShowTime(show.ticketingOpensAt) : 'Venue-controlled'}</td>
                  </tr>
                </>
              ) : null}
              <tr>
                <th>Hype</th>
                <td>{show.hypeCount}</td>
              </tr>
              <tr>
                <th>Heuristics</th>
                <td>{visibility.version}</td>
              </tr>
            </tbody>
          </table>

          <div className="explanation-block">
            <h3>Why you&apos;re seeing this</h3>
            <ul className="launch-list">
              {visibility.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
          {show.bookingLegalNotes ? (
            <div className="explanation-block">
              <h3>Legal booking snapshot</h3>
              <p>{show.bookingLegalNotes}</p>
            </div>
          ) : null}
        </aside>
      </div>

      {productionPlan ? (
        <section className="section">
          <div className="panel composer-plan-panel">
            <div className="composer-header">
                <div>
                  <div className="badge">Production plan</div>
                  <h2>Promoter run of show</h2>
                  <p className="kicker">
                  This show was assembled from artist songs and videos, recorded voice-over overdubs, sampler pads, and ad breaks inserted after every three media slots.
                  </p>
                </div>
              </div>

            <div className="composer-grid">
              <div className="composer-column">
                <div className="composer-card">
                  <h3>Artist media</h3>
                  {productionPlan.mediaItems.length ? (
                    <div className="composer-library-list">
                      {productionPlan.mediaItems.map((item) => (
                        <div className="composer-media-card" key={item.mediaId}>
                          <div>
                            <div className="composer-media-code">{item.mediaId}</div>
                            <strong>{item.title}</strong>
                            <p className="meta">
                              {item.artistName}
                              {item.notes ? ` | ${item.notes}` : ''}
                            </p>
                          </div>
                          <div className="composer-media-actions">
                            <a className="button small secondary" href={item.url} rel="noreferrer" target="_blank">
                              Open media
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty">No artist media is attached to this show.</div>
                  )}
                </div>
              </div>

              <div className="composer-column">
                <div className="composer-card">
                  <h3>Voice-over cues</h3>
                  {productionPlan.voiceOvers.length ? (
                    <div className="composer-voice-list">
                      {productionPlan.voiceOvers.map((voiceCue) => (
                        <div className="composer-voice-card" key={voiceCue.id}>
                          <strong>{voiceCue.title}</strong>
                          <p className="meta">
                            {voiceCue.durationSeconds ? `${voiceCue.durationSeconds}s` : 'Open duration'}
                            {voiceCue.cueAfterMediaId ? ` | cue after ${voiceCue.cueAfterMediaId}` : ''}
                          </p>
                          {voiceCue.script ? <p>{voiceCue.script}</p> : <p className="meta">Recorded take with no text notes.</p>}
                          {voiceCue.recordingDataUrl ? (
                            <audio className="composer-audio-preview" controls src={voiceCue.recordingDataUrl} />
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty">No voice-over cues were saved for this show.</div>
                  )}
                </div>

                <div className="composer-card">
                  <h3>Sample pad assignments</h3>
                  {productionPlan.samplePads.length ? (
                    <div className="composer-sample-grid">
                      {productionPlan.samplePads
                        .slice()
                        .sort((left, right) => (left.assignedPad ?? 99) - (right.assignedPad ?? 99))
                        .map((sample) => (
                          <div className="composer-sample-card" key={`${sample.sampleId}-${sample.assignedPad ?? 'open'}`}>
                            <div>
                              {sample.assignedPad ? (
                                <div className="composer-media-code">Pad {String(sample.assignedPad).padStart(2, '0')}</div>
                              ) : null}
                              <strong>{sample.title}</strong>
                              <p className="meta">{sample.notes ?? 'Royalty-free sample.'}</p>
                              <div className="composer-media-code">{sample.sampleId}</div>
                            </div>
                            <a className="button small secondary" href={sample.url}>
                              Open sample
                            </a>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="empty">No sample pads were saved for this show.</div>
                  )}
                </div>
              </div>

              <div className="composer-column">
                <div className="composer-card">
                  <h3>Show sequence</h3>
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
                  ) : (
                    <div className="empty">No run-of-show sequence was saved.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {show.isTicketed && show.venueProfile && show.headlinerProfile && show.venuePayoutPercent !== null && show.artistPayoutPercent !== null ? (
        <section className="section">
          <TicketSaleCard
            affiliatePromoterName={affiliatePromoter?.name ?? null}
            affiliatePromoterProfileId={affiliatePromoter?.id ?? null}
            artistName={show.headlinerProfile.name}
            artistPayoutPercent={show.artistPayoutPercent}
            currentFan={
              currentFan?.role === 'FAN'
                ? {
                    name: currentFan.name,
                    email: currentFan.email,
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
        </section>
      ) : null}

      {show.ticketOrders.length ? (
        <section className="section">
          <div className="panel" style={{ padding: '1.25rem' }}>
            <h2>Recent ticket orders</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Tax</th>
                  <th>Code</th>
                  <th>Buyer</th>
                  <th>Qty</th>
                  <th>Total</th>
                  <th>Venue</th>
                  <th>Artist</th>
                  <th>Promoter</th>
                  <th title="Total reassignments across all tickets in this order">Passed</th>
                </tr>
              </thead>
              <tbody>
                {show.ticketOrders.map((order) => {
                  const totalPassed = order.tickets.reduce((sum, t) => sum + t.reassignCount, 0);
                  return (
                  <tr key={order.id}>
                    <td>{order.status}</td>
                    <td>{formatCurrencyFromCents(order.totalTaxCents)}</td>
                    <td>{order.confirmationCode}</td>
                    <td>{order.buyerName}</td>
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
          </div>
        </section>
      ) : null}

      {show.isTicketed && show.ticketOrders.length > 0 && (
        <section className="section">
          <div className="panel" style={{ padding: '1.25rem' }}>
            <h2>Transfer your ticket</h2>
            <p className="subtitle" style={{ marginBottom: '1rem' }}>Can't make it? You can transfer your ticket to a friend — no fees, just update the holder name.</p>
            <p className="meta">Find your ticket confirmation email and visit the ticket link to reassign it, or go to <a href="/dashboard">your dashboard</a> to manage your orders.</p>
          </div>
        </section>
      )}

      {show.isRadioShow && show.radioTracks.length > 0 && (() => {
        const totalSecs = show.radioTracks.reduce((sum, t) => sum + (t.durationSecs ?? 0), 0);
        const totalDuration = totalSecs > 0
          ? `${Math.floor(totalSecs / 3600) > 0 ? `${Math.floor(totalSecs / 3600)}h ` : ''}${Math.floor((totalSecs % 3600) / 60)}m`
          : null;

        // Group tracks by blockLabel (null label = ungrouped)
        const blocks: { label: string | null; tracks: typeof show.radioTracks }[] = [];
        for (const track of show.radioTracks) {
          const last = blocks[blocks.length - 1];
          if (last && last.label === (track.blockLabel ?? null)) {
            last.tracks.push(track);
          } else {
            blocks.push({ label: track.blockLabel ?? null, tracks: [track] });
          }
        }

        return (
          <section className="section">
            <div className="panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0 }}>Tracklist</h2>
                {totalDuration && <span className="meta">{show.radioTracks.length} tracks · {totalDuration}</span>}
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
                        <li
                          key={track.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '2rem 1fr auto',
                            gap: '0.75rem',
                            alignItems: 'center',
                            padding: '0.6rem 0.75rem',
                            borderRadius: '10px',
                            background: 'rgba(255,255,255,0.03)'
                          }}
                        >
                          <span className="meta" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {String(track.position + 1).padStart(2, '0')}
                          </span>
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
                              <a href={track.externalUrl} target="_blank" rel="noreferrer" className="button small secondary" style={{ fontSize: '0.75rem' }}>
                                Play ↗
                              </a>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })()}
    </main>
  );
}
