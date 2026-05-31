import { HypeButton } from '@/components/HypeButton';
import { ShowSequencePlayer } from '@/components/ShowSequencePlayer';
import { getShowVisibilitySignals } from '@/lib/integrity';
import { formatCurrencyFromCents } from '@/lib/ticketing';
import { formatShowTime } from '@/lib/utils';
import type { parseShowProductionPlan } from '@/lib/show-composer';

type ProductionPlan = ReturnType<typeof parseShowProductionPlan>;

interface ShowMediaGridProps {
  show: {
    id: string;
    slug: string;
    title: string;
    status: string;
    hypeCount: number;
    posterImage: string | null;
    isTicketed: boolean;
    ticketPriceCents: number;
    ticketsSoldCount: number;
    ticketCapacity: number | null;
    venuePayoutPercent: number | null;
    artistPayoutPercent: number | null;
    promoterPayoutPercent: number;
    ticketingOpensAt: Date | null;
    bookingLegalNotes: string | null;
    tags: string[];
    venueProfile: { name: string } | null;
    headlinerProfile: { name: string } | null;
    promoterProfile: { name: string } | null;
  };
  productionPlan: ProductionPlan;
  userShowHype: { userId: string } | null;
  visibility: ReturnType<typeof getShowVisibilitySignals>;
}

export function ShowMediaGrid({ show, productionPlan, userShowHype, visibility }: ShowMediaGridProps) {
  return (
    <div className="grid grid-2">
      <section className="panel" style={{ padding: '1rem' }}>
        <div className="video-shell">
          {productionPlan ? (
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
              {show.posterImage
                ? <img alt={show.title} src={show.posterImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span className="meta">No audio uploaded yet</span>}
            </div>
          )}
        </div>
        {show.status !== 'DRAFT' ? (
          <HypeButton entityLabel="show" initialCount={show.hypeCount} initiallyHyped={!!userShowHype} targetId={show.id} targetType="show" />
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
  );
}
