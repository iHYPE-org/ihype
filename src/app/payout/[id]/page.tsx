import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import Link from 'next/link';
import type { Metadata } from 'next';
import { PayoutFanView } from '@/components/PayoutFanView';
import { PayoutActions } from '@/components/PayoutActions';
import { getServerT } from '@/lib/i18n/server';

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
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default async function PayoutPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getServerT();
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
  const artistPct = show.artistPayoutPercent ?? 70;
  const venuePct = show.venuePayoutPercent ?? 20;
  const promoterPct = show.promoterPayoutPercent ?? 10;
  const artistCents = Math.round(grossCents * artistPct / 100);
  const venueCents = Math.round(grossCents * venuePct / 100);
  const promoterCents = Math.round(grossCents * promoterPct / 100);
  const capacity = show.ticketCapacity ?? 0;

  const dateStr = new Date(show.startsAt).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });

  const CELLS = [
    { label: t('payoutIdPage.artist', 'Artist'), pct: artistPct, cents: artistCents, color: 'var(--accent)', name: show.headlinerProfile?.name, href: show.headlinerProfile ? `/artists/${show.headlinerProfile.slug}` : null },
    { label: t('payoutIdPage.venue', 'Venue'), pct: venuePct, cents: venueCents, color: 'var(--role-venue)', name: show.venueProfile?.name, href: show.venueProfile ? `/venues/${show.venueProfile.slug}` : null },
    { label: t('payoutIdPage.promoters', 'Promoters'), pct: promoterPct, cents: promoterCents, color: 'var(--role-fan)', name: show.promoterProfile?.name ?? t('payoutIdPage.referrersSharedPool', 'Referrers (shared pool)'), href: show.promoterProfile ? `/artists/${show.promoterProfile.slug}` : null },
  ];

  return (
    <div style={{ width: '100%', maxWidth: 620, margin: '0 auto', padding: '32px 16px 60px' }}>

      {/* Hero */}
      <div className="payout-card" style={{
        borderRadius: 24, padding: '2.5rem',
        background: 'linear-gradient(135deg, rgba(var(--accent-rgb),.15), rgba(var(--role-fan-rgb),.06))',
        border: '1px solid var(--line)', marginBottom: '1.25rem', position: 'relative', overflow: 'hidden',
      }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3, #5a5248)', marginBottom: 16 }}>
          {t('payoutIdPage.postEventPayout', 'Post-event payout')} · {dateStr}
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(1.8rem,5vw,2.8rem)', letterSpacing: '-.04em', lineHeight: .95, marginBottom: 6, color: 'var(--ink)' }}>
          {show.title}
        </h1>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '.9rem', color: 'var(--ink-2)', marginBottom: 28 }}>
          {show.venueProfile?.name ?? t('payoutIdPage.venueTbd', 'Venue TBD')}{show.venueProfile?.city ? ` · ${show.venueProfile.city}` : ''}
        </p>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-.03em', lineHeight: 1 }}>
              {sold.toLocaleString()}{capacity > 0 ? ` / ${capacity.toLocaleString()}` : ''}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3, #5a5248)', marginTop: 4 }}>{t('payoutIdPage.ticketsSold', 'Tickets sold')}</div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-.03em', lineHeight: 1 }}>{fmtCents(priceCents)}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3, #5a5248)', marginTop: 4 }}>{t('payoutIdPage.faceValue', 'Face value')}</div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-.03em', lineHeight: 1, color: 'var(--role-venue)' }}>$0</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3, #5a5248)', marginTop: 4 }}>{t('payoutIdPage.ihypeFees', 'iHYPE fees')}</div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-.03em', lineHeight: 1 }}>{fmtCents(grossCents)}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3, #5a5248)', marginTop: 4 }}>{t('payoutIdPage.gross', 'Gross')}</div>
          </div>
        </div>
      </div>

      {/* Split breakdown */}
      <div className="payout-card" style={{ background: 'var(--bg-2, #0e0b08)', border: '1px solid var(--line, var(--hair-80))', borderRadius: 18, padding: '1.5rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--role-venue)" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: 'var(--ink)' }}>{t('payoutIdPage.whereMoneyWent', 'Where the money went.')}</h2>
        </div>
        <p style={{ fontSize: '.82rem', color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 16 }}>
          {sold.toLocaleString()} {t('payoutIdPage.tickets', 'tickets')} × {fmtCents(priceCents)} = <strong style={{ color: 'var(--ink)' }}>{fmtCents(grossCents)} {t('payoutIdPage.grossLower', 'gross.')}</strong> {t('payoutIdPage.everyDollarAccounted', "Here's every dollar, accounted for.")}
        </p>
        <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', gap: 2, marginBottom: 20 }}>
          <div style={{ flex: 70, background: 'var(--accent)', borderRadius: '999px 0 0 999px' }} />
          <div style={{ flex: 20, background: 'var(--role-venue)' }} />
          <div style={{ flex: 10, background: 'var(--role-fan)', borderRadius: '0 999px 999px 0' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
          {CELLS.map((c) => (
            <div key={c.label} style={{ padding: '1rem', borderRadius: 14, border: `1px solid ${c.color}33`, background: `linear-gradient(135deg, ${c.color}14, transparent)` }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-.03em', color: c.color, lineHeight: 1 }}>{fmtCents(c.cents)}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3, #5a5248)', marginTop: 5 }}>{c.pct}% · {c.label}</div>
              <div style={{ fontSize: '.78rem', color: 'var(--ink-2)', marginTop: 4 }}>
                {c.href ? <Link href={c.href} style={{ color: 'inherit', textDecoration: 'none' }}>{c.name}</Link> : c.name}
              </div>
            </div>
          ))}
          <div style={{ padding: '1rem', borderRadius: 14, border: '1px solid rgba(var(--role-venue-rgb),.15)', background: 'rgba(var(--role-venue-rgb),.04)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-.03em', color: 'var(--role-venue)', lineHeight: 1 }}>$0</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3, #5a5248)', marginTop: 5 }}>0% · {t('payoutIdPage.platform', 'Platform')}</div>
            <div style={{ fontSize: '.78rem', color: 'var(--ink-2)', marginTop: 4 }}>iHYPE</div>
          </div>
        </div>
      </div>

      {show.isTicketed && priceCents > 0 && (
        <PayoutFanView artistPct={artistPct} priceCents={priceCents} promoterPct={promoterPct} venuePct={venuePct} />
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3, #5a5248)' }}>
          {t('payoutIdPage.ihypeTakesNothing', 'iHYPE takes nothing · locked in the charter')}
        </p>
        <div className="payout-print-actions" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link href="/payouts?tab=history" style={{ fontFamily: 'var(--font-mono)', fontSize: '.72rem', color: 'var(--ink-2)' }}>
            {t('payoutIdPage.viewAllPayouts', 'View all payouts →')}
          </Link>
          <PayoutActions title={show.title} />
        </div>
      </div>

      <style>{`
        @media print {
          .payout-print-actions { display: none !important; }
          html, body { background: #fff !important; color: #111 !important; }
          .payout-card {
            border-color: #ccc !important;
            background: #fff !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
