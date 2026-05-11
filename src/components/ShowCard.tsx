import Link from 'next/link';
import { getShowVisibilitySignals, type ReasonChip } from '@/lib/integrity';
import { formatCurrencyFromCents } from '@/lib/ticketing';
import { formatShowTime } from '@/lib/utils';

type ShowCardShow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELED';
  startsAt: Date;
  hypeCount: number;
  isRadioShow: boolean;
  radioTracks?: { durationSecs: number | null }[];
  isTicketed: boolean;
  ticketPriceCents: number;
  ticketCapacity: number | null;
  ticketsSoldCount: number;
  tags: string[];
  venueProfile: {
    name: string;
    city: string | null;
  } | null;
  headlinerProfile: {
    name: string;
  } | null;
};

export function ShowCard({
  show,
  reasonChips
}: {
  show: ShowCardShow;
  reasonChips?: ReasonChip[];
}) {
  const visibility = getShowVisibilitySignals(show);
  const allChips = [...visibility.chips, ...(reasonChips ?? [])];
  const totalSecs = show.radioTracks?.reduce((s, t) => s + (t.durationSecs ?? 0), 0) ?? 0;
  const radioDuration = show.isRadioShow && totalSecs > 0
    ? `${Math.floor(totalSecs / 3600) > 0 ? `${Math.floor(totalSecs / 3600)}h ` : ''}${Math.floor((totalSecs % 3600) / 60)}m`
    : null;

  return (
    <article className="card show-card">
      <div className="show-art" data-status={show.status}>
        {show.status === 'LIVE' ? 'LIVE NOW' : show.status === 'ENDED' ? 'ENDED' : show.status === 'CANCELED' ? 'CANCELED' : 'STREAM SHOW'}
      </div>
      <div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div className="badge">{show.status}</div>
          {show.isRadioShow && <div className="badge" style={{ background: 'rgba(113,217,255,0.1)', borderColor: 'rgba(113,217,255,0.3)', color: '#a8ecff' }}>📻 Radio</div>}
        </div>
        <h3>{show.title}</h3>
        <p className="meta">
          {formatShowTime(show.startsAt)}
          {show.venueProfile ? ` | ${show.venueProfile.name}` : ''}
          {show.headlinerProfile ? ` | ${show.headlinerProfile.name}` : ''}
        </p>
        <p>{show.description}</p>
        {radioDuration && <p className="meta">📻 {show.radioTracks?.length} tracks · {radioDuration}</p>}
        {show.isTicketed ? (
          <p className="meta">
            Tickets {formatCurrencyFromCents(show.ticketPriceCents)}
            {show.ticketCapacity ? ` | ${show.ticketsSoldCount}/${show.ticketCapacity} sold` : ` | ${show.ticketsSoldCount} sold`}
          </p>
        ) : null}
        <div className="tag-row">
          {show.tags.map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>

        <details className="reason-disclosure">
          <summary className="reason-summary">
            <span className="reason-label">Why you&apos;re seeing this</span>
            <div className="reason-chips" aria-hidden="true">
              {allChips.map((chip) => (
                <span className="reason-chip" key={chip.label} title={chip.detail}>
                  {chip.icon} {chip.label}
                </span>
              ))}
            </div>
          </summary>
          <div className="reason-detail-grid">
            {allChips.map((chip) => (
              <div className="reason-detail-row" key={chip.label}>
                <span className="reason-chip reason-chip-sm">{chip.icon} {chip.label}</span>
                <span className="reason-detail-text">{chip.detail}</span>
              </div>
            ))}
            <div className="reason-detail-row reason-version-row">
              <span className="meta">Feed heuristics v{visibility.version}</span>
            </div>
          </div>
        </details>
      </div>
      <div className="cta-row">
        <Link className="button small" href={`/shows/${show.slug}`}>
          Watch show
        </Link>
      </div>
    </article>
  );
}
