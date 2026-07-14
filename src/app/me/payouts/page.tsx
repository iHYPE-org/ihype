import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Payouts · iHYPE',
  robots: { index: false, follow: false },
};

function fmtCents(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Real payout history for the signed-in user's own profiles — every
 * AccountsPayableEntry that actually moved money via a Stripe transfer
 * (src/lib/show-payouts.ts's triggerShowPayouts), not a projection. Distinct
 * from /payout/[id], which shows a computed 45/45/10 breakdown for one show
 * the user created, whether or not it's paid out yet.
 */
export default async function MyPayoutsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/me/payouts');
  }

  const profiles = await db.profile.findMany({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  const profileIds = profiles.map((p) => p.id);

  const [released, pending] = profileIds.length
    ? await Promise.all([
        db.accountsPayableEntry.findMany({
          where: { profileId: { in: profileIds }, status: 'RELEASED' },
          include: { show: { select: { title: true, slug: true } } },
          orderBy: { paidAt: 'desc' },
          take: 100,
        }),
        db.accountsPayableEntry.findMany({
          where: { profileId: { in: profileIds }, status: 'PENDING' },
          include: { show: { select: { title: true, slug: true, status: true } } },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
      ])
    : [[], []];

  const totalReleasedCents = released.reduce((sum, e) => sum + e.amountCents, 0);

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 60 }}>
      <h1>Payouts</h1>
      <p className="meta" style={{ marginBottom: 24 }}>
        Every payout your profiles have actually received — real Stripe transfers, not a projection.
      </p>

      <div className="panel" style={{ padding: '14px 20px', marginBottom: 24, display: 'flex', gap: 24 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 24 }}>{fmtCents(totalReleasedCents)}</div>
          <div className="meta">Total received</div>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 24 }}>{released.length}</div>
          <div className="meta">Payouts</div>
        </div>
      </div>

      {released.length === 0 && pending.length === 0 && (
        <p className="meta">No payouts yet. They&apos;re released automatically once a ticketed show you&apos;re booked on ends.</p>
      )}

      {released.length > 0 && (
        <>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 12 }}>Received</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {released.map((entry) => (
              <div key={entry.id} className="panel" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {entry.show ? <Link href={`/shows/${entry.show.slug}`}>{entry.show.title}</Link> : entry.payeeLabel}
                  </div>
                  <div className="meta">{entry.payeeLabel} · {entry.paidAt ? new Date(entry.paidAt).toLocaleDateString() : ''}</div>
                </div>
                <div style={{ fontWeight: 700, color: '#22e5d4' }}>{fmtCents(entry.amountCents)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {pending.length > 0 && (
        <>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 12 }}>Pending</h2>
          <p className="meta" style={{ marginBottom: 12 }}>
            Released automatically once the show ends.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pending.map((entry) => (
              <div key={entry.id} className="panel" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {entry.show ? <Link href={`/shows/${entry.show.slug}`}>{entry.show.title}</Link> : entry.payeeLabel}
                  </div>
                  <div className="meta">{entry.payeeLabel} · {entry.show?.status ?? ''}</div>
                </div>
                <div style={{ fontWeight: 700 }}>{fmtCents(entry.amountCents)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
