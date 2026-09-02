import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { detectRequestLocation } from '@/lib/request-location';
import { resolveAffiliatePromoter } from '@/lib/referral-attribution';
import { MmmMissing } from '@/components/mmm/MmmMissing';
import { formatCurrencyFromCents } from '@/lib/ticketing';
import { formatShowTime } from '@/lib/utils';
import { isAdminSession } from '@/lib/permissions';
import { canViewShow, formatShowWhere, isTicketingOpen, resolveShowSplits, splitFaceValueCents } from '@/lib/show-detail';
import { TicketSaleCard } from '@/components/TicketSaleCard';
import { HypeButton } from '@/components/HypeButton';

export const dynamic = 'force-dynamic';

/**
 * Buying a ticket, inside the shell.
 *
 * Until now the only way to buy was `/shows/<slug>` in the legacy shell, so
 * every purchase left MMM — a different header, a different player, and no
 * route back for the rest of the session. This is that path brought in.
 *
 * ## What it deliberately does NOT do
 *
 * It is not a copy of the 964-line legacy show page. That page also carries
 * comments, setlist voting, a recap form, engagement and the sequence player,
 * and duplicating them here would create two implementations of each — the
 * exact failure the LISTEN deck was retired for. This pane carries the show's
 * identity and the transaction; everything else is one link away, and the link
 * says so rather than pretending the extras do not exist.
 *
 * ## Why TicketSaleCard is reused rather than rebuilt
 *
 * It is the transaction: quantity, the per-show cap, Turnstile (whose tokens
 * are single-use and must be reset between attempts), the 18+ gate, the
 * unverified-email path, stored payment tokens, and the capacity read. Every
 * one of those is a rule someone learned the hard way. CLAUDE.md's first rule
 * is that a design sync updates the UI layer and never replaces the wiring, so
 * the card is mounted as-is and the pane around it is the new design. Restyling
 * the card's own internals is a follow-up with the same guarantee.
 */
export default async function MmmShowPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ ref?: string; affiliate?: string }>;
}) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const session = await auth();
  // The layout gates this too; every destination keeps its own check.
  if (!session?.user?.id) redirect(`/login?callbackUrl=/app/shows/${slug}`);

  /**
   * Who gets the 10% promoter credit for a ticket bought here.
   *
   * This pane shipped passing null, which silently dropped promoter
   * attribution for every purchase made in the new shell — the pool exists to
   * pay people for exactly the journey that ends on this page. It now resolves
   * the same three ways the legacy page does, plus the HYPE-link cookie, so a
   * friend's link still pays them after a signup and a week of browsing.
   */
  const [show, viewerLocation, currentFan, affiliatePromoter] = await Promise.all([
    db.show.findUnique({
      where: { slug },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        // Needed by `canViewShow`: a DRAFT is previewable by the account that
        // created it. Without this column that rule cannot be applied here,
        // which is exactly why it was not.
        creatorId: true,
        startsAt: true,
        isTicketed: true,
        ticketPriceCents: true,
        ticketCapacity: true,
        ticketsSoldCount: true,
        ticketingOpensAt: true,
        /* S9's stat strip and hype control. Additive selects, same as the S6
           pane's storageUrl: the reference demanded data the query already
           owned the row for. */
        hypeCount: true,
        venuePayoutPercent: true,
        artistPayoutPercent: true,
        promoterPayoutPercent: true,
        headlinerProfile: { select: { name: true, slug: true } },
        promoterProfile: { select: { name: true } },
        venueProfile: {
          select: { name: true, city: true, stateRegion: true, postalCode: true, country: true },
        },
      },
    }),
    detectRequestLocation(),
    db.user
      .findUnique({
        where: { id: session.user.id },
        select: {
          name: true,
          email: true,
          role: true,
          storedPaymentTokenRef: true,
          storedPaymentTokenBrand: true,
          storedPaymentTokenLast4: true,
        },
      })
      .catch(() => null),
    resolveAffiliatePromoter({ affiliateId: query.affiliate, refHexId: query.ref }),
  ]);

  // Returned, not thrown. `notFound()` here renders the shell twice, because
  // this route's layout is async and has already flushed by the time the throw
  // happens — see `MmmMissing` for the full account.
  if (!show) return <MmmMissing />;

  /**
   * Draft visibility, ticketing and the split are `@/lib/show-detail`'s, shared
   * with the public page at `/shows/[slug]`.
   *
   * They were this file's own until 2026-08-14, and one of them had already
   * drifted: a DRAFT was hidden from EVERYONE here, including the organiser who
   * created it, while the public page has always let its creator and an admin
   * preview one. So the same person, on the same show, was told it did not
   * exist in the shell and shown it on the other URL.
   *
   * A hidden draft still returns the same surface as a missing show, which is
   * the part that must not change: "this show exists but is not public yet" is
   * not something a stranger should be able to learn from the difference
   * between two errors.
   */
  if (!canViewShow(show, { userId: session.user.id, isAdmin: isAdminSession(session) })) {
    return <MmmMissing />;
  }

  /* Whether the viewer has hyped THIS show inside the window — the same
     lookup the legacy page runs, so the button opens in its true state
     instead of resetting on every navigation. Independently caught: a failed
     read costs the button's initial state, never the page. */
  const userShowHype = await db.hypeEvent
    .findUnique({
      where: { userId_showId: { userId: session.user.id, showId: show.id } },
      select: { createdAt: true },
    })
    .catch(() => null);

  const venue = show.venueProfile;
  const where = formatShowWhere(venue);
  const ticketingOpen = isTicketingOpen(show);
  const splits = resolveShowSplits(show);
  const faceShares = splits ? splitFaceValueCents(show.ticketPriceCents, splits) : null;

  /* ── S9 · Show detail ──────────────────────────────────────────────────
     Translated from design/handoff-console/reference/s9-show-detail.html.
     What the reference adds over the old pane: the three-cell stat strip
     (HYPES · SOLD · GA), a LINEUP block, the locked-split ledger row, and the
     hype control — mounted as the real HypeButton, exactly as the legacy
     page mounts it, never redrawn. What it does not replace: TicketSaleCard
     is still the entire transaction (see the docstring above), so the
     reference's single "Get ticket" CTA is the card, not a new button. The
     LINEUP block lists the acts this query already holds — the headliner;
     multi-act slots (ShowLineupSlot) render on /shows/[slug]/lineup and are
     one link away, per this pane's own scope rule. */
  return (
    <div className="mmm-show">
      <Link className="mmm-show-back" href="/app/map">← Map</Link>

      <div className="mmm-show-eyebrow" style={{ color: 'var(--accent-text)' }}>{formatShowTime(show.startsAt)}</div>
      <h1 className="mmm-show-title">{show.title}</h1>
      {where && <div className="mmm-show-where">{where}</div>}

      {/* The reference's stat strip: three cells between hairlines. SOLD only
          renders with a capacity to be sold against, GA only with a price —
          an empty cell is dropped rather than faked. */}
      <div style={{ display: 'flex', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', margin: '14px 0' }}>
        {[
          { value: show.hypeCount.toLocaleString(), label: 'HYPES' },
          show.ticketCapacity
            ? { value: `${show.ticketsSoldCount} / ${show.ticketCapacity}`, label: 'SOLD' }
            : null,
          show.isTicketed && show.ticketPriceCents > 0
            ? { value: formatCurrencyFromCents(show.ticketPriceCents), label: 'GA' }
            : null,
        ].filter((cell): cell is { value: string; label: string } => cell !== null).map((cell, index) => (
          <div key={cell.label} style={{ flex: 1, padding: '13px 0', textAlign: 'center', borderLeft: index === 0 ? 'none' : '1px solid var(--line)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.0625rem', fontWeight: 600 }}>{cell.value}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', letterSpacing: '0.14em', color: 'var(--ink-3)' }}>{cell.label}</div>
          </div>
        ))}
      </div>

      {show.headlinerProfile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', letterSpacing: '0.2em', color: 'var(--ink-3)' }}>LINEUP</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* minHeight 44: MOBILE.md's floor on every control — grow the hit
                area, never the type. The responsive gate measures this. */}
            <Link href={`/app/artists/${show.headlinerProfile.slug}`} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontSize: '1rem', fontWeight: 600, color: 'var(--ink-1)' }}>
              {show.headlinerProfile.name}
            </Link>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', letterSpacing: '0.14em', color: 'var(--ink-3)' }}>HEADLINER</span>
          </div>
        </div>
      )}

      {/* The split, stated on the surface where money changes hands rather than
          only in the charter. These are the show's OWN percentages, not the
          70/20/10 default — a lineup or a promoter agreement can move them, and
          showing the constant here would be showing a number that is not what
          this ticket does. Absent when the show has not set one. */}
      {splits && (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: '13px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontSize: '0.9375rem', color: 'var(--ink-2)' }}>Split locked at publish</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', letterSpacing: '0.14em' }}>
              {splits.artist} / {splits.venue} / {splits.promoter} · iHYPE $0
            </span>
          </div>
          {/* WHAT the percentages are a share OF, which the row above cannot
              say on its own. The design system's money rule: the split is shown
              against face value only — against the total it would imply the
              artist's share includes money Stripe took, and the sale card
              below this ends in a total carrying tax and Stripe's processing. */}
          <div className="mmm-show-fee">
            {faceShares
              ? `${formatCurrencyFromCents(show.ticketPriceCents)} face value · ${formatCurrencyFromCents(faceShares.artist)} artist · ${formatCurrencyFromCents(faceShares.venue)} venue · ${formatCurrencyFromCents(faceShares.promoter)} promoters`
              : show.ticketPriceCents > 0 ? formatCurrencyFromCents(show.ticketPriceCents) : 'Free'}
          </div>
          <div className="mmm-show-fee">
            $0 iHYPE fee · Stripe&rsquo;s processing is charged separately and shown before you pay
          </div>
        </>
      )}

      {/* The real hype control — cooldown, optimistic count, the same endpoint
          and window as everywhere else. The reference's caption ("one hype per
          show") is the button's own behaviour, so the component says it. */}
      {show.status !== 'DRAFT' && (
        <div style={{ margin: '14px 0 4px' }}>
          <HypeButton
            entityLabel="show"
            initialCount={show.hypeCount}
            lastHypedAt={userShowHype?.createdAt.toISOString() ?? null}
            targetId={show.id}
            targetType="show"
          />
        </div>
      )}

      {show.isTicketed && venue && show.headlinerProfile && splits ? (
        <div className="mmm-show-sale">
          <TicketSaleCard
            heading="Tickets"
            affiliatePromoterName={affiliatePromoter?.name ?? null}
            affiliatePromoterProfileId={affiliatePromoter?.id ?? null}
            artistName={show.headlinerProfile.name}
            artistPayoutPercent={splits.artist}
            currentFan={
              currentFan?.role === 'FAN'
                ? {
                    name: currentFan.name,
                    email: currentFan.email ?? '',
                    hasStoredPaymentToken: Boolean(currentFan.storedPaymentTokenRef),
                    storedPaymentTokenBrand: currentFan.storedPaymentTokenBrand,
                    storedPaymentTokenLast4: currentFan.storedPaymentTokenLast4,
                  }
                : null
            }
            promoterName={show.promoterProfile?.name ?? null}
            promoterPayoutPercent={splits.promoter}
            showId={show.id}
            showSlug={show.slug}
            ticketCapacity={show.ticketCapacity}
            ticketPriceCents={show.ticketPriceCents}
            ticketingOpen={ticketingOpen}
            ticketingOpensAtLabel={show.ticketingOpensAt ? formatShowTime(show.ticketingOpensAt) : null}
            ticketsSoldCount={show.ticketsSoldCount}
            title={show.title}
            venueLocation={{
              postalCode: venue.postalCode,
              stateRegion: venue.stateRegion,
              country: venue.country,
            }}
            venueName={venue.name}
            venuePayoutPercent={splits.venue}
            viewerLocation={{
              city: viewerLocation?.city,
              stateRegion: viewerLocation?.stateRegion,
              country: viewerLocation?.country,
              postalCode: viewerLocation?.postalCode,
            }}
          />
        </div>
      ) : (
        <p className="mmm-me-note">
          This show is not selling tickets on iHYPE.
        </p>
      )}

    </div>
  );
}
