import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { LineupSplitResponder } from '@/components/LineupSplitResponder';
import { VenueLineupComposer } from '@/components/VenueLineupComposer';
import { getServerT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const show = await db.show.findUnique({ where: { slug }, select: { title: true } });
  return {
    title: show ? `Lineup Proposal · ${show.title} · iHYPE` : 'Lineup Proposal · iHYPE',
    robots: { index: false, follow: false },
  };
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default async function LineupSplitPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  const t = await getServerT();
  const { slug } = await params;

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/app/me/shows/${slug}/lineup`);
  }

  const show = await db.show.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, title: true, startsAt: true, status: true,
      artistPayoutPercent: true, venuePayoutPercent: true, promoterPayoutPercent: true,
      venueProfile: { select: { id: true, ownerId: true, name: true } },
    },
  });
  if (!show) return notFound();

  const slots = await db.showLineupSlot.findMany({
    where: { showId: show.id },
    orderBy: [{ isHeadliner: 'desc' }, { splitPercent: 'desc' }],
    select: {
      id: true, profileId: true, isHeadliner: true, splitPercent: true, status: true,
      profile: { select: { id: true, slug: true, name: true, type: true, ownerId: true, genres: true, city: true } },
    },
  });

  const isVenueOwner = canManageOwnedResource(session, show.venueProfile?.ownerId);
  const myLineupSlot = slots.find((s) => s.profile.ownerId === session.user.id) ?? null;

  if (!isVenueOwner && !myLineupSlot) return notFound();

  if (slots.length === 0) {
    return (
      <div className="lsp-page">
        {isVenueOwner ? (
          show.artistPayoutPercent != null ? (
            <>
              <div className="lsp-eyebrow">{t('showsSlugLineupPage.lineupProposal', 'Lineup Proposal')}</div>
              <h1 className="lsp-title">{fmtDate(show.startsAt)} @ {show.venueProfile?.name ?? t('showsSlugLineupPage.tbd', 'TBD')}</h1>
              <p className="lsp-sub">{t('showsSlugLineupPage.noLineupProposedYet', 'No lineup has been proposed yet — add every billed act and their split below.')}</p>
              <VenueLineupComposer artistPayoutPercent={show.artistPayoutPercent} existingSlots={[]} showId={show.id} />
            </>
          ) : (
            <div className="lsp-empty">
              <p>{t('showsSlugLineupPage.noArtistPayoutPercentSet', 'This show has no artist payout percentage set yet — set that up first.')}</p>
              <Link href={`/app/shows/${show.slug}`}>{t('showsSlugLineupPage.backToShow', 'Back to show →')}</Link>
            </div>
          )
        ) : (
          <div className="lsp-empty">
            <p>{t('showsSlugLineupPage.noLineupSplitProposed', 'No lineup split has been proposed for this show yet.')}</p>
            <Link href={`/app/shows/${show.slug}`}>{t('showsSlugLineupPage.backToShow', 'Back to show →')}</Link>
          </div>
        )}
      </div>
    );
  }

  const venuePercent = show.venuePayoutPercent ?? 0;
  const promoterPercent = show.promoterPayoutPercent ?? 0;

  return (
    <div className="lsp-page">
      <div className="lsp-eyebrow">{t('showsSlugLineupPage.lineupProposal', 'Lineup Proposal')}</div>
      <h1 className="lsp-title">{fmtDate(show.startsAt)} @ {show.venueProfile?.name ?? t('showsSlugLineupPage.tbd', 'TBD')}</h1>
      <p className="lsp-sub">
        {t('showsSlugLineupPage.proposedByPrefix', 'Proposed by')} {show.venueProfile?.name ?? t('showsSlugLineupPage.theVenue', 'the venue')} · {t('showsSlugLineupPage.everyArtistMustAccept', 'every artist below must accept before this booking locks.')}
      </p>

      <div className="lsp-splitbar">
        {slots.map((s) => (
          <div key={s.id} className="lsp-splitbar-seg" style={{ flex: s.splitPercent, background: s.isHeadliner ? 'var(--accent)' : 'var(--accent-2)' }} />
        ))}
        <div className="lsp-splitbar-seg" style={{ flex: venuePercent, background: 'var(--role-venue)' }} />
        <div className="lsp-splitbar-seg" style={{ flex: promoterPercent, background: 'var(--role-fan)' }} />
      </div>
      <div className="lsp-splitbar-legend">
        <span>{slots.map((s) => `${s.profile.name} ${s.splitPercent}%`).join(' · ')}</span>
        <span>{t('showsSlugLineupPage.venueLabel', 'Venue')} {venuePercent}% · {t('showsSlugLineupPage.promotersLabel', 'Promoters')} {promoterPercent}%</span>
      </div>

      <div className="lsp-eyebrow" style={{ marginTop: 32, marginBottom: 14 }}>{t('showsSlugLineupPage.lineup', 'Lineup')}</div>
      <div className="lsp-list">
        {slots.map((s) => {
          const isMe = s.profile.ownerId === session.user!.id;
          return (
            <div className="lsp-card" key={s.id}>
              <div className="lsp-card-row">
                <div className="lsp-card-who">
                  <div className="lsp-avatar" aria-hidden>{s.profile.name.slice(0, 1).toUpperCase()}</div>
                  <div>
                    <div className="lsp-name">{s.profile.name}</div>
                    <div className="lsp-meta">{s.isHeadliner ? t('showsSlugLineupPage.headliner', 'Headliner') : t('showsSlugLineupPage.support', 'Support')} · {s.splitPercent}% {t('showsSlugLineupPage.ofThePoolPrefix', 'of the')} {show.artistPayoutPercent}% {t('showsSlugLineupPage.pool', 'pool')}</div>
                  </div>
                </div>
                <span className={`lsp-pill lsp-pill-${s.status.toLowerCase()}`}>
                  {s.status === 'ACCEPTED' ? t('showsSlugLineupPage.accepted', 'Accepted') : s.status === 'DECLINED' ? t('showsSlugLineupPage.declined', 'Declined') : t('showsSlugLineupPage.awaiting', 'Awaiting')}
                </span>
              </div>
              {isMe && s.status === 'PENDING' && (
                <div className="lsp-card-actions">
                  <LineupSplitResponder showId={show.id} splitPercent={s.splitPercent} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {myLineupSlot && myLineupSlot.status !== 'PENDING' && (
        <div className={`lsp-status-note lsp-status-note-${myLineupSlot.status.toLowerCase()}`}>
          {myLineupSlot.status === 'ACCEPTED' ? (
            <>
              <div className="lsp-status-label">{t('showsSlugLineupPage.youveAccepted', "You've accepted")}</div>
              <p>
                {slots.some((s) => s.status === 'PENDING')
                  ? `${t('showsSlugLineupPage.waitingOnPrefix', 'Waiting on')} ${slots.filter((s) => s.status === 'PENDING').map((s) => s.profile.name).join(', ')}. ${t('showsSlugLineupPage.youllBeNotified', "You'll be notified the moment the booking locks.")}`
                  : t('showsSlugLineupPage.bookingHasLocked', 'The booking has locked — this show is on sale.')}
              </p>
            </>
          ) : (
            <>
              <div className="lsp-status-label">{t('showsSlugLineupPage.youDeclined', 'You declined')}</div>
              <p>{show.venueProfile?.name ?? t('showsSlugLineupPage.theVenueCapitalized', 'The venue')} {t('showsSlugLineupPage.hasBeenNotified', 'has been notified. They may revise the split and re-propose.')}</p>
            </>
          )}
        </div>
      )}

      {isVenueOwner && show.status === 'DRAFT' && show.artistPayoutPercent != null && (
        <VenueLineupComposer
          artistPayoutPercent={show.artistPayoutPercent}
          existingSlots={slots.map((s) => ({
            profileSlug: s.profile.slug,
            profileName: s.profile.name,
            splitPercent: s.splitPercent,
            isHeadliner: s.isHeadliner,
          }))}
          showId={show.id}
        />
      )}

      {isVenueOwner && (
        <p className="lsp-foot">
          <Link href={`/app/shows/${show.slug}`}>{t('showsSlugLineupPage.backToShowPlain', 'Back to show')}</Link>
        </p>
      )}

      <style>{`
        .lsp-page { max-width: 640px; margin: 0 auto; padding: 32px 24px 100px; }
        .lsp-empty { text-align: center; padding: 60px 24px; color: var(--ink-a65); }
        .lsp-empty a { color: var(--ink-a70); }
        .lsp-eyebrow { font-family: var(--font-mono); font-size: 0.6875rem; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-a65); }
        .lsp-title { font-family: var(--font-display); font-size: 1.625rem; font-weight: 800; letter-spacing: -.03em; margin: 6px 0; color: var(--ink); }
        .lsp-sub { font-size: 0.9375rem; color: var(--ink-a65); margin: 0 0 24px; }
        .lsp-splitbar { display: flex; height: 8px; border-radius: var(--radius-pill); overflow: hidden; gap: 2px; margin-bottom: 8px; }
        .lsp-splitbar-seg { min-width: 2px; }
        .lsp-splitbar-legend { display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 0.9375rem; color: var(--ink-a65); gap: 12px; flex-wrap: wrap; }
        .lsp-list { display: flex; flex-direction: column; gap: 12px; }
        .lsp-card { border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--bg2); padding: 18px 20px; }
        .lsp-card-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
        .lsp-card-who { display: flex; gap: 12px; align-items: center; }
        .lsp-avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--line); display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-weight: 800; color: var(--ink); flex-shrink: 0; }
        .lsp-name { font-family: var(--font-display); font-weight: 800; font-size: 0.9375rem; color: var(--ink); }
        .lsp-meta { font-size: 0.9375rem; color: var(--ink-a65); margin-top: 2px; }
        .lsp-pill { flex-shrink: 0; font-family: var(--font-mono); font-size: 0.9375rem; text-transform: uppercase; letter-spacing: .1em; padding: 5px 10px; border-radius: var(--radius-pill); }
        .lsp-pill-pending { background: rgba(var(--warning-rgb),.15); color: var(--warning-text); }
        .lsp-pill-accepted { background: rgba(var(--role-venue-rgb),.15); color: var(--role-venue); }
        .lsp-pill-declined { background: rgba(var(--accent-rgb),.15); color: var(--accent-text); }
        .lsp-card-actions { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line); }
        .lsp-status-note { margin-top: 20px; padding: 14px 16px; border-radius: var(--radius-md); border: 1px solid var(--line); }
        .lsp-status-note p { font-size: 0.9375rem; color: var(--ink-a65); line-height: 1.6; margin: 6px 0 0; }
        .lsp-status-label { font-family: var(--font-mono); font-size: 0.9375rem; letter-spacing: .08em; text-transform: uppercase; }
        .lsp-status-note-accepted { border-color: rgba(var(--role-venue-rgb),.25); background: rgba(var(--role-venue-rgb),.06); }
        .lsp-status-note-accepted .lsp-status-label { color: var(--role-venue); }
        .lsp-status-note-declined { border-color: rgba(var(--accent-rgb),.25); background: rgba(var(--accent-rgb),.06); }
        .lsp-status-note-declined .lsp-status-label { color: var(--accent-text); }
        .lsp-foot { margin-top: 24px; font-size: 0.9375rem; }
        .lsp-foot a { color: var(--ink-a65); text-decoration: none; }
        .lsp-foot a:hover { color: var(--ink); text-decoration: underline; }
      `}</style>
    </div>
  );
}
