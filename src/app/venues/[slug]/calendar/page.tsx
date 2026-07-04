import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await db.profile.findUnique({ where: { slug }, select: { name: true } });
  if (!profile) return {};
  return { title: `${profile.name} Calendar · iHYPE` };
}

export const dynamic = 'force-dynamic';

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default async function VenueCalendarPage({ params }: Props) {
  const { slug } = await params;

  const profile = await db.profile.findUnique({
    where: { slug },
    select: { id: true, name: true, type: true, city: true, stateRegion: true }
  });

  if (!profile || profile.type !== 'VENUE') notFound();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

  const shows = await db.show.findMany({
    where: {
      venueProfileId: profile.id,
      status: { not: 'CANCELED' },
      startsAt: { gte: startOfMonth, lte: endOfMonth }
    },
    select: { id: true, title: true, slug: true, startsAt: true, status: true },
    orderBy: { startsAt: 'asc' }
  });

  const showsByDay = new Map<number, typeof shows>();
  for (const show of shows) {
    const day = show.startsAt.getDate();
    if (!showsByDay.has(day)) showsByDay.set(day, []);
    showsByDay.get(day)!.push(show);
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const monthName = startOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const cells: Array<number | null> = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="container section" style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 16 }}>
        <Link href={`/venues/${slug}`} className="text-link" style={{ fontSize: 13 }}>
          ← Back to {profile.name}
        </Link>
      </div>
      <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 28, marginBottom: 4 }}>
        {profile.name}
      </h1>
      <p className="meta" style={{ marginBottom: 24 }}>{monthName} — {shows.length} show{shows.length !== 1 ? 's' : ''}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 8 }}>
        {dayNames.map((d) => (
          <div key={d} style={{ fontFamily: 'var(--f-m)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textAlign: 'center', padding: '4px 0', letterSpacing: '.08em', textTransform: 'uppercase' }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((day, idx) => {
          const dayShows = day ? (showsByDay.get(day) ?? []) : [];
          const isToday = day === now.getDate();
          return (
            <div
              key={idx}
              style={{
                minHeight: 80,
                padding: '6px 8px',
                borderRadius: 6,
                background: day ? 'var(--bg-2)' : 'transparent',
                border: isToday ? '1px solid var(--accent)' : '1px solid transparent'
              }}
            >
              {day ? (
                <>
                  <span style={{ fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--accent)' : 'var(--ink-2)' }}>
                    {day}
                  </span>
                  {dayShows.map((s) => (
                    <Link
                      key={s.id}
                      href={`/shows/${s.slug}`}
                      style={{
                        display: 'block',
                        marginTop: 4,
                        fontSize: 10,
                        fontFamily: 'var(--f-m)',
                        color: 'var(--ink)',
                        background: 'rgba(185,131,255,.15)',
                        borderRadius: 4,
                        padding: '2px 4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        textDecoration: 'none'
                      }}
                      title={s.title}
                    >
                      {s.startsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} {s.title}
                    </Link>
                  ))}
                </>
              ) : null}
            </div>
          );
        })}
      </div>

      {shows.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Upcoming shows</h2>
          {shows.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ minWidth: 60, fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 20, color: 'var(--accent)' }}>
                {s.startsAt.getDate()}
              </div>
              <div>
                <Link href={`/shows/${s.slug}`} style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15, color: 'var(--ink)', textDecoration: 'none' }}>
                  {s.title}
                </Link>
                <p style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)', margin: '2px 0 0' }}>
                  {s.startsAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {s.startsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
