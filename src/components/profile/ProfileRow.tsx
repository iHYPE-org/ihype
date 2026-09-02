import Link from 'next/link';
import type { RowTrail } from '@/lib/show-row';

/**
 * One dated row on a public profile — a show, or a tour-calendar day.
 *
 * The console profile template draws every row the same way: a date block,
 * a title with one line of meta under it, and a trail that says the one
 * thing a fan needs first ("On stage now", "On sale"). Both profile pages
 * used to draw this row themselves, inline, and had drifted: the artist's
 * rows ended in a "Get ticket" pill whether or not a ticket could be bought,
 * the venue's in a heat dot with no legend. One component, one shape.
 *
 * `utc` is for calendar days stored at UTC midnight (`AvailabilityDate`): a
 * local-time read shifts every date to the evening before for anyone west of
 * Greenwich. A show's `startsAt` is an instant and reads in local time.
 */
export function ProfileRow({
  href,
  date,
  utc = false,
  title,
  meta,
  trail,
}: {
  href?: string;
  date: Date;
  utc?: boolean;
  title: string;
  meta?: string | null;
  trail?: RowTrail | null;
}) {
  const month = date.toLocaleDateString('en-US', utc ? { month: 'short', timeZone: 'UTC' } : { month: 'short' }).toUpperCase();
  const day = utc ? date.getUTCDate() : date.getDate();
  const body = (
    <>
      <span className="mmm-profile-row-date">
        <span className="mmm-profile-row-month">{month}</span>
        <span className="mmm-profile-row-day">{day}</span>
      </span>
      <span className="mmm-profile-row-main">
        <span className="mmm-profile-row-title">{title}</span>
        {meta ? <span className="mmm-profile-row-meta">{meta}</span> : null}
      </span>
      {trail ? <span className="mmm-profile-row-trail" data-tone={trail.tone}>{trail.label}</span> : null}
    </>
  );
  return (
    <li>
      {href
        ? <Link className="mmm-profile-row" href={href}>{body}</Link>
        : <div className="mmm-profile-row">{body}</div>}
    </li>
  );
}

/**
 * The counters under a profile's actions — the public stat catalogue's
 * figures, three of them, in the template's order. A value that could not be
 * read renders as a dash, never as 0: a zero is a claim about the artist.
 */
export function ProfileCounters({ counters }: { counters: { label: string; value: number | null }[] }) {
  return (
    <div className="mmm-profile-counters">
      {counters.map((counter) => (
        <div className="mmm-profile-counter" key={counter.label}>
          <span className="mmm-profile-counter-value">{counter.value === null ? '—' : counter.value.toLocaleString()}</span>
          <span className="mmm-profile-counter-label">{counter.label}</span>
        </div>
      ))}
    </div>
  );
}
