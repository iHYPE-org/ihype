import '../marketing.css';
import Link from 'next/link';
import type { Metadata } from 'next';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Transparency | iHYPE.org',
};

export default async function TransparencyPage() {
  const [artistCount, showCount, mediaCount, ticketCount, totalTicketCents] = await Promise.all([
    db.profile.count({ where: { type: 'ARTIST' } }),
    db.show.count({ where: { status: { not: 'CANCELED' } } }),
    db.artistMediaAsset.count(),
    db.ticketOrder.count({ where: { status: { not: 'VOID' } } }),
    db.ticketOrder
      .aggregate({ _sum: { subtotalCents: true }, where: { status: { not: 'VOID' } } })
      .then((r) => r._sum.subtotalCents ?? 0),
  ]);

  const totalPaidOut = totalTicketCents; // 0% fee means 100% goes to artists

  const STATS = [
    { label: 'Artists on platform', val: artistCount.toLocaleString(), c: '#ff5029' },
    { label: 'Shows listed', val: showCount.toLocaleString(), c: '#22e5d4' },
    { label: 'Tracks uploaded', val: mediaCount.toLocaleString(), c: '#b983ff' },
    { label: 'Tickets sold', val: ticketCount.toLocaleString(), c: '#ff3e9a' },
    { label: 'Paid out to artists/venues', val: `$${(totalPaidOut / 100).toLocaleString()}`, c: '#22e5d4' },
    { label: 'Platform fee taken', val: '$0', c: '#ff5029' },
  ];

  return (
    <div className="lp-wrap">
      <section className="lp-hero" style={{ paddingBottom: '20px' }}>
        <p className="lp-hype-eyebrow" style={{ color: '#ffb84a' }}>
          <span
            style={{
              display: 'inline-block',
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#ffb84a',
              marginRight: 8,
            }}
          />
          LIVE STATS · UPDATED IN REAL TIME
        </p>
        <h1 className="lp-hero-h" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}>Transparency report</h1>
        <p className="lp-hero-sub">
          Every dollar of ticket revenue goes directly to artists and venues. Here&apos;s the proof.
        </p>
      </section>

      {/* Stats grid */}
      <section className="lp-stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '40px' }}>
        {STATS.map((s) => (
          <div key={s.label} className="lp-stat">
            <span className="lp-stat-val" style={{ color: s.c }}>{s.val}</span>
            <span className="lp-stat-label">{s.label}</span>
          </div>
        ))}
      </section>

      {/* How this works */}
      <section className="lp-hype-explainer">
        <p className="lp-hype-eyebrow" style={{ color: '#ff5029' }}>HOW IT WORKS</p>
        <h2 className="lp-section-head">The full picture</h2>
        <div className="lp-reason-grid" style={{ marginTop: '20px' }}>
          {[
            {
              icon: '◇',
              c: '#ff5029',
              head: 'Tickets',
              body: 'Tickets are sold at face value set by the artist or venue. iHYPE charges 0% on every transaction. Settlement goes directly to the organiser — only the card-processing fee (2.9% + $0.30, at cost) sits above face value.',
            },
            {
              icon: '◐',
              c: '#ff3e9a',
              head: 'Hype',
              body: 'Listening to a track all the way through, or manually hyping an artist, registers a Hype. It is a demand signal — no money changes hands and iHYPE earns nothing from it.',
            },
            {
              icon: '◉',
              c: '#22e5d4',
              head: 'Radio',
              body: 'Live and recorded radio shows are free for all hosts on the platform. There is no tier that unlocks hosting; every DJ and promoter gets the same tools.',
            },
            {
              icon: '♡',
              c: '#b983ff',
              head: 'Data',
              body: 'iHYPE does not sell, license, or monetise listener data. Analytics are visible only to the artist or venue they belong to.',
            },
          ].map((r) => (
            <div key={r.icon} className="lp-reason-card">
              <div className="lp-reason-icon" style={{ color: r.c }}>{r.icon}</div>
              <h3 className="lp-reason-head">{r.head}</h3>
              <p className="lp-reason-body">{r.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="lp-footer-cta">
        <div className="lp-hero-actions" style={{ justifyContent: 'center' }}>
          <Link href="/about" className="lp-btn-primary">About iHYPE</Link>
          <Link href="/register" className="lp-btn-ghost">Join free →</Link>
        </div>
      </section>
    </div>
  );
}
