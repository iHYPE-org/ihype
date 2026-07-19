import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { getVenueDashboardData } from '@/lib/venue-dashboard';
import { formatCurrencyFromCents } from '@/lib/ticketing';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await db.profile.findUnique({ where: { slug }, select: { name: true } });
  return {
    title: profile ? `${profile.name} · Dashboard · iHYPE` : 'Venue Dashboard · iHYPE',
    robots: { index: false, follow: false },
  };
}

export default async function VenueDashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/venues/${slug}/dashboard`);
  }

  const profile = await db.profile.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, type: true, ownerId: true },
  });
  if (!profile || profile.type !== 'VENUE') return notFound();

  const isOwner = canManageOwnedResource(session, profile.ownerId);
  if (!isOwner) return notFound();

  const data = await getVenueDashboardData(profile.id);

  return (
    <div className="vdash">
      <header className="vdash-head">
        <div>
          <div className="vdash-eyebrow">Welcome back</div>
          <h1>{profile.name}</h1>
        </div>
        <div className="vdash-head-actions">
          <Link className="vdash-btn vdash-btn-outline" href="/me/booking">Booking Inbox</Link>
          <Link className="vdash-btn vdash-btn-solid" href="/events/new">+ Create Event</Link>
        </div>
      </header>

      <div className="vdash-stats">
        <div className="vdash-card">
          <div className="vdash-card-label">This Month</div>
          <div className="vdash-card-val">{formatCurrencyFromCents(data.thisMonthEarningsCents)}</div>
          <div className="vdash-card-sub">Your split share this calendar month · $0 iHYPE fee</div>
        </div>
        <div className="vdash-card">
          <div className="vdash-card-label">Shows Booked</div>
          <div className="vdash-card-val">{data.showsBookedCount}</div>
          <div className="vdash-card-sub vdash-card-sub-accent">{data.upcomingShowsCount} upcoming</div>
        </div>
        <div className="vdash-card">
          <div className="vdash-card-label">Pending Requests</div>
          <div className="vdash-card-val">{data.pendingBookingRequestCount}</div>
          <div className="vdash-card-sub vdash-card-sub-accent">
            {data.pendingBookingRequestCount > 0 ? 'Needs review' : 'All caught up'}
          </div>
        </div>
        <div className="vdash-card">
          <div className="vdash-card-label">Next Payout</div>
          <div className="vdash-card-val">{data.nextPayout?.label ?? '—'}</div>
          <div className="vdash-card-sub">
            {data.nextPayout?.amountCents != null
              ? `${formatCurrencyFromCents(data.nextPayout.amountCents)} pending release`
              : data.nextPayout?.estimated
                ? 'Estimated — depends on ticket sales before then'
                : 'No pending payouts right now'}
          </div>
        </div>
      </div>

      <div className="vdash-grid">
        <div>
          <div className="vdash-section-head">
            <span className="vdash-eyebrow-sm">Upcoming Shows</span>
            <Link className="vdash-link-sm" href={`/venues/${profile.slug}/calendar`}>Full calendar →</Link>
          </div>
          {data.upcomingShows.length === 0 ? (
            <div className="vdash-empty">No upcoming shows — accept a booking to get started.</div>
          ) : (
            <div className="vdash-shows">
              {data.upcomingShows.map((show) => {
                const date = show.startsAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                const soldLabel = show.ticketCapacity
                  ? `${show.ticketsSoldCount.toLocaleString()} / ${show.ticketCapacity.toLocaleString()} sold`
                  : `${show.ticketsSoldCount.toLocaleString()} sold`;
                return (
                  <Link className="vdash-show-row" href={`/shows/${show.slug}`} key={show.id}>
                    <div>
                      <div className="vdash-show-title">{show.title}</div>
                      <div className="vdash-show-meta">{date} · {soldLabel}</div>
                    </div>
                    <span className="vdash-pill">{show.status === 'LIVE' ? 'Live' : 'On sale'}</span>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="vdash-section-head" style={{ marginTop: 28 }}>
            <span className="vdash-eyebrow-sm">Activity</span>
          </div>
          {data.activity.length === 0 ? (
            <div className="vdash-empty">No activity yet.</div>
          ) : (
            <div className="vdash-activity">
              {data.activity.map((item) => (
                <div className="vdash-activity-row" key={item.id}>
                  <span className="vdash-activity-dot" style={{ background: item.color }} />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="vdash-eyebrow-sm">Quick Actions</div>
          <div className="vdash-actions">
            <Link className="vdash-action" href="/me/booking">Review booking requests</Link>
            <Link className="vdash-action" href={`/venues/${profile.slug}/calendar`}>View calendar</Link>
            {data.nextScannableShowSlug && (
              <Link className="vdash-action" href={`/shows/${data.nextScannableShowSlug}/scan`}>Door check-in scanner</Link>
            )}
            <Link className="vdash-action" href={`/venues/${profile.slug}`}>View analytics</Link>
            <Link className="vdash-action" href={`/venues/${profile.slug}`}>Edit my page</Link>
          </div>
        </div>
      </div>

      <style>{`
        .vdash { max-width: 1000px; margin: 0 auto; padding: 32px 24px 80px; }
        .vdash-head { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px; margin-bottom: 28px; }
        .vdash-eyebrow { font-family: var(--font-mono); font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-a50); margin-bottom: 6px; }
        .vdash-head h1 { font-family: var(--font-display); font-size: 28px; font-weight: 800; letter-spacing: -.02em; margin: 0; color: var(--ink); }
        .vdash-head-actions { display: flex; gap: 10px; }
        .vdash-btn { display: inline-flex; align-items: center; padding: 10px 18px; border-radius: var(--radius-pill); font-size: 13px; font-weight: 700; text-decoration: none; min-height: 44px; }
        .vdash-btn-outline { background: transparent; color: var(--ink); border: 1px solid var(--line-2); }
        .vdash-btn-outline:hover { background: var(--hair-40); }
        .vdash-btn-solid { background: var(--role-venue, #22e5d4); color: #0a0805; border: 1px solid var(--role-venue, #22e5d4); }
        .vdash-btn-solid:hover { opacity: .9; }
        .vdash-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
        .vdash-card { border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--bg2); padding: 18px 20px; }
        .vdash-card-label { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-a50); margin-bottom: 6px; }
        .vdash-card-val { font-family: var(--font-display); font-weight: 800; font-size: 24px; color: var(--role-venue, #22e5d4); }
        .vdash-card-sub { font-size: 11.5px; color: var(--ink-a50); margin-top: 2px; }
        .vdash-card-sub-accent { color: var(--role-venue, #22e5d4); }
        .vdash-grid { display: grid; grid-template-columns: 1fr 300px; gap: 20px; }
        .vdash-section-head { display: flex; justify-content: space-between; align-items: baseline; }
        .vdash-eyebrow-sm { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: .1em; color: var(--ink-a50); }
        .vdash-link-sm { font-family: var(--font-mono); font-size: 11px; letter-spacing: .06em; color: var(--ink-a60); text-decoration: none; }
        .vdash-link-sm:hover { color: var(--ink); }
        .vdash-empty { text-align: center; padding: 36px 20px; color: var(--ink-a50); border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--bg2); margin-top: 12px; margin-bottom: 12px; font-size: 14px; }
        .vdash-shows { border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--bg2); margin-top: 12px; margin-bottom: 12px; overflow: hidden; }
        .vdash-show-row { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--line); text-decoration: none; color: inherit; }
        .vdash-show-row:last-child { border-bottom: none; }
        .vdash-show-row:hover { background: var(--bg3); }
        .vdash-show-title { font-family: var(--font-display); font-weight: 800; font-size: 14px; color: var(--ink); }
        .vdash-show-meta { font-size: 12px; color: var(--ink-a60); margin-top: 2px; }
        .vdash-pill { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--role-venue, #22e5d4); background: rgba(34,229,212,.12); border-radius: var(--radius-pill); padding: 5px 10px; flex-shrink: 0; }
        .vdash-activity { display: flex; flex-direction: column; gap: 2px; margin-top: 12px; }
        .vdash-activity-row { display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-bottom: 1px solid var(--line); font-size: 13px; color: var(--ink-a85); }
        .vdash-activity-row:last-child { border-bottom: none; }
        .vdash-activity-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; margin-top: 6px; }
        .vdash-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
        .vdash-action { display: flex; align-items: center; justify-content: center; text-align: center; padding: 10px 16px; min-height: 44px; border-radius: var(--radius-md); border: 1px solid var(--line-2); color: var(--ink); text-decoration: none; font-size: 13px; font-weight: 700; }
        .vdash-action:hover { background: var(--hair-40); }

        @media (max-width: 720px) {
          .vdash-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
