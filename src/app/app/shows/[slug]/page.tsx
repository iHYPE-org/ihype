import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { detectRequestLocation } from '@/lib/request-location';
import { resolveAffiliatePromoter } from '@/lib/referral-attribution';
import { MmmMissing } from '@/components/mmm/MmmMissing';
import { formatCurrencyFromCents } from '@/lib/ticketing';
import { formatShowTime } from '@/lib/utils';
import { TicketSaleCard } from '@/components/TicketSaleCard';

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
        startsAt: true,
        isTicketed: true,
        ticketPriceCents: true,
        ticketCapacity: true,
        ticketsSoldCount: true,
        ticketingOpensAt: true,
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
  // A DRAFT show is private — the same rule the legacy page enforces, and what
  // keeps a lineup-pending show unbookable while acts are still deciding. It
  // returns the same surface as a missing one on purpose: "this show exists but
  // is not public yet" is not something a stranger should be able to learn.
  if (show.status === 'DRAFT') return <MmmMissing />;

  const venue = show.venueProfile;
  const where = [venue?.name, venue?.city].filter(Boolean).join(' · ');
  const ticketingOpen =
    show.status === 'LIVE' || Boolean(show.ticketingOpensAt && show.ticketingOpensAt <= new Date());

  /**
   * `venuePayoutPercent` and `artistPayoutPercent` are nullable, and the legacy
   * page gates its split panel on both being set rather than defaulting them.
   * Same here, for a stronger reason: this is the surface where money changes
   * hands, so a split shown as 70/20/10 because the real one is missing would
   * be a promise the payout engine has not agreed to.
   */
  const splits =
    show.venuePayoutPercent !== null && show.artistPayoutPercent !== null
      ? {
          artist: show.artistPayoutPercent,
          venue: show.venuePayoutPercent,
          promoter: show.promoterPayoutPercent,
        }
      : null;

  return (
    <div className="mmm-show">
      <Link className="mmm-show-back" href="/app/map">← Map</Link>

      <div className="mmm-show-eyebrow">{formatShowTime(show.startsAt)}</div>
      <h1 className="mmm-show-title">{show.title}</h1>
      {where && <div className="mmm-show-where">{where}</div>}
      <div className="mmm-show-by">
        {show.headlinerProfile ? (
          <Link href={`/artists/${show.headlinerProfile.slug}`}>{show.headlinerProfile.name}</Link>
        ) : null}
      </div>

      {/* The split, stated on the surface where money changes hands rather than
          only in the charter. These are the show's OWN percentages, not the
          70/20/10 default — a lineup or a promoter agreement can move them, and
          showing the constant here would be showing a number that is not what
          this ticket does. Absent when the show has not set one. */}
      {splits && (
        <>
          <div className="mmm-show-split" role="group" aria-label="Where the money goes">
            <span className="mmm-show-split-part" data-role="artist" style={{ flexGrow: splits.artist }}>
              {splits.artist}% artist
            </span>
            <span className="mmm-show-split-part" data-role="venue" style={{ flexGrow: splits.venue }}>
              {splits.venue}% venue
            </span>
            <span className="mmm-show-split-part" data-role="promoter" style={{ flexGrow: splits.promoter }}>
              {splits.promoter}% promoters
            </span>
          </div>
          <div className="mmm-show-fee">
            {show.ticketPriceCents > 0 ? formatCurrencyFromCents(show.ticketPriceCents) : 'Free'} · $0 iHYPE fee
          </div>
        </>
      )}

      {show.isTicketed && venue && show.headlinerProfile && splits ? (
        <div className="mmm-show-sale">
          <TicketSaleCard
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

      {/* Honest about what is not here yet, rather than a bare link. */}
      <Link className="mmm-show-more" href={`/shows/${show.slug}`}>
        Comments, setlist and recap →
      </Link>
    </div>
  );
}
