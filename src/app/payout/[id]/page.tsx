import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import Link from 'next/link';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const show = await db.show.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    select: { title: true },
  });
  return {
    title: show ? `Payout · ${show.title} · iHYPE` : 'Payout · iHYPE',
    robots: { index: false, follow: false },
  };
}

function fmtCents(cents: number) {
  if (cents >= 100000) return `$${(cents / 100000).toFixed(1)}k`;
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function PayoutPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    const { id } = await params;
    redirect(`/login?callbackUrl=/payout/${id}`);
  }

  const { id } = await params;

  const show = await db.show.findFirst({
    where: {
      OR: [{ id }, { slug: id }],
      creatorId: session.user.id,
    },
    select: {
      id: true, slug: true, title: true, status: true,
      startsAt: true, endsAt: true, isTicketed: true,
      ticketPriceCents: true, ticketCapacity: true, ticketsSoldCount: true,
      artistPayoutPercent: true, venuePayoutPercent: true, promoterPayoutPercent: true,
      headlinerProfile: { select: { name: true, slug: true, type: true } },
      venueProfile: { select: { name: true, slug: true, city: true } },
      promoterProfile: { select: { name: true, slug: true } },
    },
  });

  if (!show) notFound();

  const priceCents = show.ticketPriceCents ?? 0;
  const sold = show.ticketsSoldCount ?? 0;
  const grossCents = priceCents * sold;
  const artistPct = show.artistPayoutPercent ?? 45;
  const venuePct = show.venuePayoutPercent ?? 45;
  const promoterPct = show.promoterPayoutPercent ?? 10;
  const artistCents = Math.round(grossCents * artistPct / 100);
  const venueCents = Math.round(grossCents * venuePct / 100);
  const promoterCents = Math.round(grossCents * promoterPct / 100);
  const capacity = show.ticketCapacity ?? 0;
  const fillPct = capacity > 0 ? Math.min(100, Math.round((sold / capacity) * 100)) : 0;

  const dateStr = new Date(show.startsAt).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 24px 100px' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <Link href="/home" style={{ fontSize: 12, color: 'rgba(240,235,229,.4)', textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '.06em' }}>
          ← BACK TO HOME
        </Link>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', marginTop: 16, marginBottom: 6 }}>
          PAYOUT BREAKDOWN
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 800, letterSpacing: '-.03em', margin: '0 0 6px' }}>
          {show.title}
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(240,235,229,.45)', margin: 0 }}>
          {dateStr}
          {show.venueProfile?.city ? ` · ${show.venueProfile.city}` : ''}
          {' · '}
          <span style={{
            display: 'inline-block', padding: '2px 8px', borderRadius: 4,
            fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '.08em', textTransform: 'uppercase',
            background: show.status === 'LIVE' ? 'rgba(255,80,41,.15)' : 'rgba(255,255,255,.06)',
            color: show.status === 'LIVE' ? 'var(--accent)' : 'rgba(240,235,229,.4)',
          }}>
            {show.status}
          </span>
        </p>
      </div>

      {/* Gross revenue card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255,80,41,.1), rgba(185,131,255,.06))',
        border: '1px solid rgba(255,80,41,.2)',
        borderRadius: 12, padding: '24px 28px', marginBottom: 24,
        display: 'flex', gap: 32, flexWrap: 'wrap',
      }}>
        <div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(240,235,229,.4)', marginBottom: 4 }}>Gross revenue</p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-.03em', margin: 0, color: 'var(--ink)' }}>{fmtCents(grossCents)}</p>
        </div>
        <div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(240,235,229,.4)', marginBottom: 4 }}>Tickets sold</p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-.03em', margin: 0, color: 'var(--ink)' }}>
            {sold.toLocaleString()}{capacity > 0 ? ` / ${capacity.toLocaleString()}` : ''}
          </p>
        </div>
        {capacity > 0 && (
          <div style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(240,235,229,.4)', marginBottom: 8 }}>Capacity {fillPct}%</p>
            <div style={{ height: 6, background: 'rgba(255,255,255,.08)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${fillPct}%`, background: 'var(--accent)', borderRadius: 3, transition: 'width .6s' }} />
            </div>
          </div>
        )}
      </div>

      {/* Split breakdown */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(240,235,229,.4)', marginBottom: 12 }}>
          Split — locked in the charter · iHYPE takes 0%
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: show.headlinerProfile?.name ?? 'Artist', role: 'ARTIST', pct: artistPct, cents: artistCents, color: '#ff5029', href: show.headlinerProfile ? `/artists/${show.headlinerProfile.slug}` : null },
            { label: show.venueProfile?.name ?? 'Venue', role: 'VENUE', pct: venuePct, cents: venueCents, color: '#22e5d4', href: show.venueProfile ? `/venues/${show.venueProfile.slug}` : null },
            { label: show.promoterProfile?.name ?? 'Promoter', role: 'DJ', pct: promoterPct, cents: promoterCents, color: '#ff3e9a', href: show.promoterProfile ? `/artists/${show.promoterProfile.slug}` : null },
            { label: 'iHYPE', role: 'PLATFORM', pct: 0, cents: 0, color: 'rgba(240,235,229,.3)', href: null },
          ].map(row => (
            <div key={row.role} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 18px', border: '1px solid rgba(255,255,255,.07)',
              borderRadius: 8, background: 'var(--bg-2, #100d09)',
            }}>
              <div style={{
                width: 44, minWidth: 44, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18,
                color: row.color, textAlign: 'right',
              }}>{row.pct}%</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
                  {row.href ? (
                    <Link href={row.href} style={{ color: 'inherit', textDecoration: 'none' }}>{row.label}</Link>
                  ) : row.label}
                </div>
              </div>
              <div style={{
                fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18,
                color: row.color, textAlign: 'right',
              }}>
                {row.pct === 0 ? '$0.00' : fmtCents(row.cents)}
              </div>
              <div style={{ width: 120 }}>
                <div style={{ height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${row.pct}%`, background: row.color, borderRadius: 2 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ticket price */}
      {show.isTicketed && priceCents > 0 && (
        <div style={{
          padding: '16px 20px', border: '1px solid rgba(255,255,255,.07)',
          borderRadius: 8, background: 'var(--bg-2, #100d09)',
          display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 24,
        }}>
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(240,235,229,.35)', marginBottom: 4 }}>Ticket price</p>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, margin: 0 }}>{fmtCents(priceCents)}</p>
          </div>
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(240,235,229,.35)', marginBottom: 4 }}>Platform fee</p>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, margin: 0, color: '#22e5d4' }}>$0.00</p>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <Link href={`/shows/${show.slug}`} style={{
          padding: '11px 20px', border: '1px solid rgba(255,255,255,.1)',
          borderRadius: 8, fontSize: 13, color: 'rgba(240,235,229,.6)',
          textDecoration: 'none', fontFamily: 'var(--font-mono)',
        }}>
          View show page
        </Link>
        <Link href="/home" style={{
          padding: '11px 20px', background: 'rgba(255,80,41,.15)',
          border: '1px solid rgba(255,80,41,.25)',
          borderRadius: 8, fontSize: 13, color: 'var(--accent)',
          textDecoration: 'none', fontFamily: 'var(--font-mono)',
        }}>
          Back to home
        </Link>
      </div>
    </div>
  );
}
