import type { Locale } from '@/lib/i18n/locales';
import { formatDate, formatUsd } from '@/lib/format-locale';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { LineupSplitResponder } from '@/components/LineupSplitResponder';
import { VenueLineupComposer } from '@/components/VenueLineupComposer';
import { getServerI18n } from '@/lib/i18n/server';
import { renderAndHashAgreement } from '@/lib/split-agreement';
import { describePayoutMethod, parseApprovedDeductions, termsFor } from '@/lib/split-agreement-data';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const show = await db.show.findUnique({ where: { slug }, select: { title: true } });
  return {
    title: show ? `Lineup offer · ${show.title} · iHYPE` : 'Lineup offer · iHYPE',
    robots: { index: false, follow: false },
  };
}

function fmtDate(d: Date, locale: Locale) {
  return formatDate(locale, d, { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * The Lineup Offer and its Show Revenue Split Agreements (DESIGN_SYNC row
 * 528). The venue sends and revises the offer here — sending is its
 * signature — and each act reads its full agreement and signs or declines
 * here. Signed agreements download as a PDF from this page for either party.
 */
export default async function LineupOfferPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  const { locale, t } = await getServerI18n();
  const { slug } = await params;

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/app/me/shows/${slug}/lineup`);
  }

  const show = await db.show.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, title: true, startsAt: true, timeZone: true, status: true, isTicketed: true, ticketPriceCents: true,
      venueProfile: {
        select: {
          id: true, ownerId: true, name: true, paymentReportHoldAt: true,
          addressLine1: true, city: true, stateRegion: true, postalCode: true,
        },
      },
    },
  });
  if (!show || !show.venueProfile) return notFound();
  const venue = show.venueProfile;

  const slots = await db.showLineupSlot.findMany({
    where: { showId: show.id },
    orderBy: [{ isHeadliner: 'desc' }, { splitPercent: 'desc' }],
    select: {
      id: true, profileId: true, isHeadliner: true, splitPercent: true, status: true,
      guaranteeCents: true, approvedDeductions: true, guarantorName: true, juryWaiver: true,
      agreementHash: true, venueSignedAt: true,
      agreement: { select: { id: true, supersededAt: true, artistSignedAt: true } },
      profile: {
        select: {
          id: true, slug: true, name: true, ownerId: true,
          payoutMethodKind: true, payoutMethodDetails: true,
        },
      },
    },
  });

  const isVenueOwner = venue.ownerId === session.user.id;
  const isAdmin = isAdminSession(session);
  const myLineupSlot = slots.find((s) => s.profile.ownerId === session.user.id) ?? null;
  if (!isVenueOwner && !myLineupSlot && !isAdmin) return notFound();

  const beforeShow = show.startsAt.getTime() > Date.now() && ['DRAFT', 'SCHEDULED'].includes(show.status);
  const canCompose = isVenueOwner && beforeShow && !venue.paymentReportHoldAt;

  /* The act reads exactly the text the venue signed: rendered here from the
     stored offer, and its hash compared to the venue's on the way in. */
  const myAgreement = myLineupSlot && myLineupSlot.status === 'PENDING' && myLineupSlot.agreementHash
    ? await renderAndHashAgreement(termsFor({ show, venue, artistName: myLineupSlot.profile.name, slot: myLineupSlot }))
    : null;
  const myAgreementCurrent = Boolean(myAgreement && myAgreement.hash === myLineupSlot?.agreementHash);

  const anySigned = slots.some((s) => s.agreement && !s.agreement.supersededAt);
  const money = (cents: number) => formatUsd(locale, cents, 2);

  return (
    <div className="lsp-page">
      <div className="lsp-eyebrow">{t('showsSlugLineupPage.lineupOffer', 'Lineup offer')}</div>
      <h1 className="lsp-title">{show.title}</h1>
      <p className="lsp-sub">
        {fmtDate(show.startsAt, locale)} @ {venue.name} · {t('showsSlugLineupPage.offerExplainer', 'Each act signs its own Show Revenue Split Agreement with the venue. The venue receives every ticket sale and pays each act its share within 7 days of the show. iHYPE holds none of the money.')}
      </p>

      {venue.paymentReportHoldAt && (
        <div className="lsp-status-note lsp-status-note-declined">
          <div className="lsp-status-label">{t('showsSlugLineupPage.holdLabel', 'Paused')}</div>
          <p>{t('showsSlugLineupPage.holdBody', 'This venue has an artist payment report that is unresolved past the settlement window. New offers and ticket sales are paused until it is resolved.')}</p>
        </div>
      )}

      {slots.length === 0 && !isVenueOwner && (
        <div className="lsp-empty"><p>{t('showsSlugLineupPage.noOfferYet', 'The venue has not sent an offer for this show yet.')}</p></div>
      )}

      {slots.length > 0 && (
        <>
          <div className="lsp-eyebrow" style={{ marginTop: 24, marginBottom: 14 }}>{t('showsSlugLineupPage.lineup', 'Lineup')}</div>
          <div className="lsp-list">
            {slots.map((s) => {
              const isMe = s.profile.ownerId === session.user!.id;
              const deductions = parseApprovedDeductions(s.approvedDeductions);
              const signed = s.agreement && !s.agreement.supersededAt ? s.agreement : null;
              return (
                <div className="lsp-card" key={s.id}>
                  <div className="lsp-card-row">
                    <div className="lsp-card-who">
                      <div className="lsp-avatar" aria-hidden>{s.profile.name.slice(0, 1).toUpperCase()}</div>
                      <div>
                        <div className="lsp-name">{s.profile.name}</div>
                        <div className="lsp-meta">
                          {s.isHeadliner ? t('showsSlugLineupPage.headliner', 'Headliner') : t('showsSlugLineupPage.support', 'Support')}
                          {' · '}{s.splitPercent}% {t('showsSlugLineupPage.ofNetReceipts', 'of Net Ticket Receipts')}
                          {s.guaranteeCents ? ` · ${t('showsSlugLineupPage.guaranteePrefix', 'guarantee')} ${money(s.guaranteeCents)}` : ''}
                          {deductions.length ? ` · ${deductions.length} ${t('showsSlugLineupPage.deductionsCount', 'approved deduction(s)')}` : ''}
                        </div>
                      </div>
                    </div>
                    <span className={`lsp-pill lsp-pill-${signed ? 'accepted' : s.status === 'DECLINED' ? 'declined' : 'pending'}`}>
                      {signed
                        ? t('showsSlugLineupPage.signed', 'Signed')
                        : s.status === 'DECLINED'
                          ? t('showsSlugLineupPage.declined', 'Declined')
                          : s.venueSignedAt
                            ? t('showsSlugLineupPage.awaitingSignature', 'Awaiting signature')
                            : t('showsSlugLineupPage.awaitingResend', 'Venue must resend')}
                    </span>
                  </div>
                  {signed && (isMe || isVenueOwner || isAdmin) && (
                    <div className="lsp-card-actions">
                      <a className="lsp-link" href={`/api/split-agreements/${signed.id}/pdf`}>{t('showsSlugLineupPage.downloadPdf', 'Download the signed agreement (PDF)')}</a>
                      {isVenueOwner && (
                        <p className="lsp-payto">
                          {t('showsSlugLineupPage.payTo', 'Pay to:')} {describePayoutMethod(s.profile.payoutMethodKind, s.profile.payoutMethodDetails) ?? t('showsSlugLineupPage.noMethod', 'not on file')}
                        </p>
                      )}
                    </div>
                  )}
                  {isMe && s.status === 'PENDING' && (
                    <div className="lsp-card-actions">
                      {myAgreement && myAgreementCurrent ? (
                        <LineupSplitResponder
                          agreementHash={myAgreement.hash}
                          agreementText={myAgreement.text}
                          hasPayoutMethod={Boolean(describePayoutMethod(s.profile.payoutMethodKind, s.profile.payoutMethodDetails))}
                          payoutSettingsHref="/app/me/payouts?tab=settings"
                          showId={show.id}
                        />
                      ) : (
                        <p className="lsp-meta">{t('showsSlugLineupPage.waitForResend', 'The show changed after the venue signed. The venue has to send the offer again before you can sign.')}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {myLineupSlot && myLineupSlot.status === 'DECLINED' && (
        <div className="lsp-status-note lsp-status-note-declined">
          <div className="lsp-status-label">{t('showsSlugLineupPage.youDeclined', 'You declined')}</div>
          <p>{t('showsSlugLineupPage.declinedBody', 'The venue has been told. It may revise the offer and send it again.')}</p>
        </div>
      )}

      {canCompose && (
        <VenueLineupComposer
          existingSlots={slots.map((s) => ({
            profileSlug: s.profile.slug,
            profileName: s.profile.name,
            splitPercent: s.splitPercent,
            isHeadliner: s.isHeadliner,
            guaranteeCents: s.guaranteeCents,
            approvedDeductions: parseApprovedDeductions(s.approvedDeductions),
          }))}
          initialGuarantorName={slots[0]?.guarantorName ?? null}
          initialJuryWaiver={slots[0]?.juryWaiver ?? false}
          show={{ id: show.id }}
        />
      )}

      <p className="lsp-foot">
        {anySigned && (
          <>
            <Link href={`/app/me/shows/${show.slug}/settlement`}>{t('showsSlugLineupPage.settlementLink', 'Settlement statement')}</Link>
            {' · '}
          </>
        )}
        <Link href={`/app/shows/${show.slug}`}>{t('showsSlugLineupPage.backToShowPlain', 'Back to show')}</Link>
      </p>

      <style>{`
        .lsp-page { max-width: 680px; margin: 0 auto; padding: 32px 24px 100px; }
        .lsp-empty { text-align: center; padding: 40px 24px; color: var(--ink-a65); }
        .lsp-eyebrow { font-family: var(--font-mono); font-size: 0.6875rem; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-a65); }
        .lsp-title { font-family: var(--font-display); font-size: 1.625rem; font-weight: 800; letter-spacing: -.03em; margin: 6px 0; color: var(--ink); }
        .lsp-sub { font-size: 0.9375rem; color: var(--ink-a65); margin: 0 0 20px; line-height: 1.6; }
        .lsp-list { display: flex; flex-direction: column; gap: 12px; }
        .lsp-card { border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--bg2); padding: 18px 20px; }
        .lsp-card-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
        .lsp-card-who { display: flex; gap: 12px; align-items: center; }
        .lsp-avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--line); display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-weight: 800; color: var(--ink); flex-shrink: 0; }
        .lsp-name { font-family: var(--font-display); font-weight: 800; font-size: 0.9375rem; color: var(--ink); }
        .lsp-meta { font-size: 0.9375rem; color: var(--ink-a65); margin-top: 2px; line-height: 1.5; }
        .lsp-pill { flex-shrink: 0; font-family: var(--font-mono); font-size: 0.9375rem; text-transform: uppercase; letter-spacing: .1em; padding: 5px 10px; border-radius: var(--radius-pill); }
        .lsp-pill-pending { background: rgba(var(--warning-rgb),.15); color: var(--warning-text); }
        .lsp-pill-accepted { background: rgba(var(--role-venue-rgb),.15); color: var(--role-venue); }
        .lsp-pill-declined { background: rgba(var(--accent-rgb),.15); color: var(--accent-text); }
        .lsp-card-actions { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line); }
        .lsp-link { display: inline-flex; align-items: center; min-height: 44px; color: var(--accent-text); font-size: 0.9375rem; }
        .lsp-payto { font-size: 0.9375rem; color: var(--ink-2); margin: 4px 0 0; }
        .lsp-status-note { margin-top: 20px; padding: 14px 16px; border-radius: var(--radius-md); border: 1px solid var(--line); }
        .lsp-status-note p { font-size: 0.9375rem; color: var(--ink-a65); line-height: 1.6; margin: 6px 0 0; }
        .lsp-status-label { font-family: var(--font-mono); font-size: 0.9375rem; letter-spacing: .08em; text-transform: uppercase; }
        .lsp-status-note-declined { border-color: rgba(var(--accent-rgb),.25); background: rgba(var(--accent-rgb),.06); }
        .lsp-status-note-declined .lsp-status-label { color: var(--accent-text); }
        .lsp-foot { margin-top: 24px; font-size: 0.9375rem; }
        .lsp-foot a { color: var(--ink-a65); text-decoration: none; display: inline-flex; min-height: 44px; align-items: center; }
        .lsp-foot a:hover { color: var(--ink); text-decoration: underline; }
      `}</style>
    </div>
  );
}
