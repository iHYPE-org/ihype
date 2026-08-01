// Moved verbatim from its former standalone route when Trust & Safety,
// Transparency, Privacy and Legal were merged into /info. Every Prisma
// query, the k-anonymity floor and the copy are unchanged — only the
// route wrapper and page metadata were stripped so this can render as
// a panel. The old route is now a redirect.
import '@/app/marketing.css';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getServerT } from '@/lib/i18n/server';

export async function TransparencyPanel() {
  const t = await getServerT();
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
    { label: t('transparencyPage.statArtistsOnPlatform', 'Artists on platform'), val: artistCount.toLocaleString(), c: '#ff5029' },
    { label: t('transparencyPage.statShowsListed', 'Shows listed'), val: showCount.toLocaleString(), c: '#22e5d4' },
    { label: t('transparencyPage.statTracksUploaded', 'Tracks uploaded'), val: mediaCount.toLocaleString(), c: '#b983ff' },
    { label: t('transparencyPage.statTicketsSold', 'Tickets sold'), val: ticketCount.toLocaleString(), c: '#ff3e9a' },
    { label: t('transparencyPage.statPaidOut', 'Paid out to artists/venues'), val: `$${(totalPaidOut / 100).toLocaleString()}`, c: '#22e5d4' },
    { label: t('transparencyPage.statPlatformFee', 'Platform fee taken'), val: '$0', c: '#ff5029' },
  ];

  return (
    <div className="lp-wrap">
      <section className="lp-hero" style={{ paddingBottom: '20px' }}>
        <p className="lp-hype-eyebrow" style={{ color: 'var(--role-promoter)' }}>
          <span
            style={{
              display: 'inline-block',
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'var(--role-promoter)',
              marginRight: 8,
            }}
          />
          {t('transparencyPage.liveStatsEyebrow', 'LIVE STATS · UPDATED IN REAL TIME')}
        </p>
        <h1 className="lp-hero-h" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}>{t('transparencyPage.heroTitle', 'Transparency report')}</h1>
        <p className="lp-hero-sub">
          {t('transparencyPage.heroSub', "Every dollar of ticket revenue goes directly to artists and venues. Here's the proof.")}
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
        <p className="lp-hype-eyebrow" style={{ color: 'var(--accent)' }}>{t('transparencyPage.howItWorksEyebrow', 'HOW IT WORKS')}</p>
        <h2 className="lp-section-head">{t('transparencyPage.fullPictureHeading', 'The full picture')}</h2>
        <div className="lp-reason-grid" style={{ marginTop: '20px' }}>
          {[
            {
              icon: '◇',
              c: '#ff5029',
              head: t('transparencyPage.reasonTicketsHead', 'Tickets'),
              body: t('transparencyPage.reasonTicketsBody', 'Tickets are sold at face value set by the artist or venue. iHYPE charges 0% on every transaction. Settlement goes directly to the organiser — only the card-processing fee (2.9% + $0.30, at cost) sits above face value.'),
            },
            {
              icon: '◐',
              c: '#ff3e9a',
              head: t('transparencyPage.reasonHypeHead', 'Hype'),
              body: t('transparencyPage.reasonHypeBody', 'Listening to a track all the way through, or manually hyping an artist, registers a Hype. It is a demand signal — no money changes hands and iHYPE earns nothing from it.'),
            },
            {
              icon: '◉',
              c: '#22e5d4',
              head: t('transparencyPage.reasonRadioHead', 'Radio'),
              body: t('transparencyPage.reasonRadioBody', 'Live and recorded radio shows are free for all hosts on the platform. There is no tier that unlocks hosting; every DJ and promoter gets the same tools.'),
            },
            {
              icon: '♡',
              c: '#b983ff',
              head: t('transparencyPage.reasonDataHead', 'Data'),
              body: t('transparencyPage.reasonDataBody', 'iHYPE does not sell, license, or monetise listener data. Analytics are visible only to the artist or venue they belong to.'),
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
          {/* The "About iHYPE" button that sat here pointed at /about, which is
              now a redirect back into this same hub — a button that reloads the
              page you are on. Join is the only CTA left that goes anywhere. */}
          <Link href="/register" className="lp-btn-primary">{t('transparencyPage.joinFree', 'Join free →')}</Link>
        </div>
      </section>
    </div>
  );
}
