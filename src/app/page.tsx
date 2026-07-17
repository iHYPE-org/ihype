import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PiAdminButton } from '@/components/PiAdminButton';
import { db } from '@/lib/db';
import { IndexTabsShowcase } from '@/components/IndexTabsShowcase';
import { IndexStickyCta } from '@/components/IndexStickyCta';
import { getBaseUrl } from '@/lib/utils';

const TITLE = 'iHYPE — Your local music scene, completely free';
const DESCRIPTION = 'iHYPE is your local music scene in one app. Discover the artists, DJs, and live shows happening near you, hype the moments you love, and grab tickets with zero fees. Completely free — no subscription, no catch.';
const SOCIAL_DESCRIPTION = 'Your local music scene in one app. Discover artists and live shows near you, hype the moments you love, and get tickets with zero fees. Completely free.';

const COMPARISON_ROWS: [string, string, string, string][] = [
  ['Service fees on tickets', '✗ up to 27%', '—', '✓ 0%'],
  ['Dynamic / surge pricing', '✗ yes', '—', '✓ never'],
  ['Payola / pay-to-play algorithms', '—', '✗ yes', '✓ never'],
  ['Takes a cut of artist revenue', '—', '✗ ~70% kept', '✓ 0%'],
  ['Sells fan data to advertisers', '✗ yes', '✗ yes', '✓ never'],
  ['Locks artists into exclusivity', '✗ some deals', '✗ some deals', '✓ no lock-in'],
  ['Charges for platform access', '✗ yes', '✗ yes', '✓ completely free'],
];

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: getBaseUrl() },
  openGraph: {
    type: 'website',
    siteName: 'iHYPE',
    title: TITLE,
    description: SOCIAL_DESCRIPTION,
    url: getBaseUrl(),
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: SOCIAL_DESCRIPTION,
  },
};

export default async function RootPage() {
  const session = await auth();
  if (session?.user?.id) redirect('/home');

  const [artistCount, fanCount, totalHypes, showCount] = await Promise.all([
    db.profile.count({ where: { type: 'ARTIST' } }).catch(() => 0),
    db.profile.count({ where: { type: 'LISTENER' } }).catch(() => 0),
    db.profileHypeEvent.count().catch(() => 0),
    db.show.count({ where: { status: { in: ['SCHEDULED', 'LIVE'] } } }).catch(() => 0),
  ]);

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n);

  return (
    <div style={{ paddingBottom: '6rem' }}>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="idx-hero-section" style={{ padding: 'clamp(4rem, 10vw, 8rem) 0 3rem', position: 'relative' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '3rem', alignItems: 'center' }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontFamily: 'var(--f-m)', fontSize: '0.75rem', letterSpacing: '.2em', color: 'var(--accent)', textTransform: 'uppercase', margin: '0 0 1rem' }}>
                Completely free · your local scene
              </p>
              {/* Live stats bar */}
              <div className="idx-hero-stats" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {[
                  { value: fmt(artistCount), label: 'artists' },
                  { value: fmt(fanCount), label: 'fans' },
                  { value: fmt(totalHypes), label: 'hypes' },
                  { value: fmt(showCount), label: 'shows live' },
                ].map((s, i) => (
                  <div className="idx-hero-pill" key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.3rem 0.75rem', borderRadius: 999,
                    border: '1px solid var(--hair-80)',
                    background: 'var(--hair-40)',
                  }}>
                    <span style={{ fontFamily: 'var(--f-m)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent)' }}>{s.value}</span>
                    <span style={{ fontFamily: 'var(--f-m)', fontSize: '0.75rem', color: 'var(--ink-3)', letterSpacing: '.04em' }}>{s.label}</span>
                  </div>
                ))}
              </div>

              <h1 className="idx-hero-h1" style={{
                fontFamily: 'var(--f-d)',
                fontWeight: 800,
                fontSize: 'clamp(3rem, 8vw, 6.5rem)',
                lineHeight: 0.93,
                letterSpacing: '-0.04em',
                margin: '0 0 1.5rem',
                color: 'var(--ink)',
                overflowWrap: 'break-word',
              }}>
                The gate<br />
                belongs to<br />
                <span style={{
                  background: 'linear-gradient(90deg, var(--accent), #ff3e9a)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>the artists.</span>
              </h1>
              <p className="idx-hero-sub" style={{
                fontFamily: 'var(--f-b)',
                fontSize: 'clamp(1rem, 2vw, 1.2rem)',
                color: 'var(--ink-2)',
                maxWidth: '52ch',
                lineHeight: 1.65,
                margin: '0 0 2rem',
              }}>
                iHYPE is your local scene built for the people who make it.
                Hype who you believe in, grab tickets with zero fees, and earn
                by spreading the word — with 70% of every ticket locked to the
                artist, forever.
              </p>

              {/* Mobile-only: the pitch has to convert without a scroll — desktop
                  relies on the final CTA section further down the page. */}
              <div className="idx-hero-cta">
                <Link href="/register" className="idx-hero-cta-primary">Join Beta — it&apos;s free →</Link>
                <Link href="/login" className="idx-hero-cta-secondary">Already have an account? <u>Sign in</u></Link>
              </div>
            </div>

          </div>

        </div>
        <style>{`
          .idx-hero-cta { display: none; }
          @media (max-width: 768px) {
            .idx-hero-section { padding: 1.5rem 0 1.25rem !important; }
            .idx-hero-stats { margin-bottom: 0.85rem !important; gap: 0.35rem !important; }
            .idx-hero-pill { padding: 0.25rem 0.6rem !important; }
            .idx-hero-h1 { font-size: clamp(2.5rem, 12.5vw, 3.5rem) !important; margin-bottom: 0.75rem !important; }
            .idx-hero-sub { font-size: 0.95rem !important; margin-bottom: 1.1rem !important; }
            .idx-hero-cta {
              display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.25rem;
            }
            .idx-hero-cta-primary {
              display: flex; align-items: center; justify-content: center; gap: 8px;
              font-family: var(--f-d); font-weight: 800; font-size: 0.95rem;
              background: var(--accent); color: #fff; border-radius: 14px;
              padding: 0.9rem; text-decoration: none;
              box-shadow: 0 10px 30px -8px rgba(255,80,41,.55);
            }
            .idx-hero-cta-secondary {
              display: flex; align-items: center; justify-content: center;
              font-family: var(--f-b); font-size: 0.8rem; color: var(--ink-3); text-decoration: none;
            }
            .idx-hero-cta-secondary u { color: var(--ink-2); }
          }
        `}</style>
      </section>

      {/* ── Why iHYPE exists ─────────────────────────────────── */}
      <section style={{ padding: '2rem 0 3rem' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'start' }} className="why-grid-inner">
            <div>
              <p style={{ fontFamily: 'var(--f-m)', fontSize: '0.75rem', letterSpacing: '.2em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                WHY IHYPE EXISTS
              </p>
              <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 'clamp(1.8rem, 4vw, 3rem)', letterSpacing: '-0.03em', color: 'var(--ink)', margin: '0 0 1.25rem', lineHeight: 1.02 }}>
                Pay-to-play was never the deal.
              </h2>
              <p style={{ fontFamily: 'var(--f-b)', fontSize: '1.05rem', lineHeight: 1.65, color: 'var(--ink-a72)', maxWidth: '42ch', margin: '0 0 1rem' }}>
                Venues book artists people will actually show up for — but have no way to know that on their own, so they lean on promoters chasing their own cut, and ticket platforms tack on fees on top of that. What&apos;s left barely covers the room.
              </p>
              <p style={{ fontFamily: 'var(--f-b)', fontSize: '1.05rem', lineHeight: 1.65, color: 'var(--ink-a72)', maxWidth: '42ch', margin: 0 }}>
                Fans never hear the new stuff. Artists can&apos;t afford to keep making it. Venues stop booking. iHYPE exists to break that cycle — by taking nothing out of it.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { color: '#ff5029', name: 'Completely free', desc: 'No ticket fees, no subscription, no cost to host an artist, DJ, or venue page — for anyone.' },
                { color: '#b983ff', name: 'Anyone can get paid to promote', desc: 'Real word-of-mouth income for whoever brings the fan — not payola, not an algorithm.' },
                { color: '#22e5d4', name: 'Open for public audit', desc: 'Our code and our heuristics are published. Anyone can check that the split does what we say.' },
                { color: '#ffb84a', name: 'Your data is never for sale', desc: 'No aggregating it, no selling it, no exceptions — not now, not after an acquisition.' },
                { color: '#ff3e9a', name: 'You get a vote', desc: 'Users are stakeholders. Real changes to the platform go to the people who use it.' },
                { color: '#22e5d4', name: 'Funded like radio, not like Big Tech', desc: 'Advertising only, restricted to music sources — never your data.' },
              ].map(item => (
                <div key={item.name} style={{ display: 'flex', gap: 14, padding: 16, background: 'var(--hair-30)', border: '1px solid var(--hair-70)', borderRadius: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, marginTop: 6, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 4 }}>{item.name}</div>
                    <p style={{ fontFamily: 'var(--f-b)', fontSize: 13, lineHeight: 1.5, color: 'var(--ink-a50)', margin: 0 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p style={{ fontFamily: 'var(--f-m)', fontSize: '0.8rem', letterSpacing: '.04em', color: 'var(--ink-3)', marginTop: '2rem', maxWidth: '60ch' }}>
            Two people run the whole thing, leaning on AI automation to keep costs near zero — on purpose. There&apos;s no boardroom to talk us out of the charter. Made for the scene, powered by the people who love it. <a href="/legal?tab=charter" style={{ color: 'var(--ink-2)' }}>Read the full charter →</a>
          </p>
        </div>
        <style>{`
          @media (max-width:768px) { .why-grid-inner { grid-template-columns:1fr!important; gap:2rem!important; } }
        `}</style>
      </section>

      {/* ── Three Tabs Showcase ──────────────────────────────── */}
      <section style={{ padding: '3rem 0 2rem' }}>
        <div className="container">
          <p style={{ fontFamily: 'var(--f-m)', fontSize: '0.75rem', letterSpacing: '.2em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
            THE APP
          </p>
          <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 'clamp(1.8rem, 4vw, 3rem)', letterSpacing: '-0.03em', color: 'var(--ink)', margin: '0 0 1.5rem' }}>
            Everything in three taps.
          </h2>
          <IndexTabsShowcase />
        </div>
      </section>

      {/* ── What's a HYPE? ───────────────────────────────────── */}
      <section style={{ padding: '2rem 0 3rem' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'start' }} className="hype-grid-inner">
            {/* Left: intro */}
            <div>
              <p style={{ fontFamily: 'var(--f-m)', fontSize: '0.75rem', letterSpacing: '.2em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                THE MECHANIC
              </p>
              <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 'clamp(1.8rem, 4vw, 3rem)', letterSpacing: '-0.03em', color: 'var(--ink)', margin: '0 0 1.25rem' }}>
                What&apos;s a HYPE?
              </h2>
              <p style={{ fontFamily: 'var(--f-b)', fontSize: '1.05rem', lineHeight: 1.6, color: 'var(--ink-a72)', maxWidth: '38ch', margin: '0 0 1.5rem' }}>
                A HYPE is a vote on a <em style={{ color: 'var(--accent)', fontStyle: 'italic' }}>moment</em>. While a track plays, you fire a hype at the exact second it hits — the drop, the verse, the breakdown. Those timestamps stack into real demand signals that artists and venues use to build setlists and book shows.
              </p>
              {/* Hype fire chip */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 9999, background: 'rgba(255,80,41,.1)', border: '1px solid rgba(255,80,41,.28)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5029', boxShadow: '0 0 0 4px rgba(255,80,41,.18)', display: 'inline-block', animation: 'hype-dot-pulse 1.4s ease-in-out infinite' }} />
                <span style={{ fontFamily: 'var(--f-m)', fontSize: '0.7rem', letterSpacing: '0.18em', color: '#ff5029', textTransform: 'uppercase' }}>HYPE FIRES AT 3:38</span>
              </div>
            </div>

            {/* Right: steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { num: '01', color: '#ff5029', name: 'Hit the moment', desc: 'Tap to hype while a track plays. Your vote lands on the timestamp — not the whole song.' },
                { num: '02', color: '#b983ff', name: 'One member, one vote', desc: 'Every hype counts the same, regardless of spend. No pay-to-rank, no payola, no algorithm.' },
                { num: '03', color: '#22e5d4', name: 'It feeds the radar', desc: 'Hypes roll up into the demand radar — telling artists what to play and venues who to book near you.' },
              ].map(step => (
                <div key={step.num} style={{ display: 'flex', gap: 16, padding: 18, background: 'var(--hair-30)', border: '1px solid var(--hair-70)', borderRadius: 10 }}>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 18, flexShrink: 0, width: 28, color: step.color }}>{step.num}</div>
                  <div>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 4 }}>{step.name}</div>
                    <p style={{ fontFamily: 'var(--f-b)', fontSize: 13, lineHeight: 1.5, color: 'var(--ink-a50)', margin: 0 }}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <style>{`
          @keyframes hype-dot-pulse { 0%,100%{opacity:1}50%{opacity:.4} }
          @media (max-width:768px) { .hype-grid-inner { grid-template-columns:1fr!important; gap:2rem!important; } }
        `}</style>
      </section>

      {/* ── For who? ─────────────────────────────────────────── */}
      <section style={{ padding: '3rem 0' }}>
        <div className="container">
          <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 'clamp(1.8rem, 4vw, 3rem)', letterSpacing: '-0.03em', color: 'var(--ink)', margin: '0 0 1.5rem' }}>
            Built for everyone in the room.
          </h2>
          <div className="grid grid-2 idx-roles-grid" style={{ gap: '0.75rem' }}>
            {[
              { role: 'Artists', color: '#ff5029', icon: '🎤', href: '/register?role=ARTIST', items: ['70% of every ticket you sell', 'Upload music as swipeable Seeds', 'Build your public page and catalog', 'See who\'s hyping your work'] },
              { role: 'Fans', color: '#b983ff', icon: '🎧', href: '/register?role=FAN', items: ['Discover new music before it blows up', 'Buy tickets with no fees', 'Earn 10% on tickets you refer', 'Track your scene with hype streaks'] },
              { role: 'Promoters / DJs', color: '#ffb84a', icon: '🎛️', href: '/register?role=DJ', items: ['10% referral on every ticket you drive', 'Host radio shows on the platform', 'Build a following and grow your scene', 'Referral links for every event'] },
              { role: 'Venues', color: '#22e5d4', icon: '🏛️', href: '/register?role=VENUE', items: ['20% of every show you host', 'Zero ticketing fees for buyers', 'Demand radar shows what\'s trending', 'Connect with artists and promoters'] },
            ].map(r => (
              <div className="idx-role-card" key={r.role} style={{
                padding: '1.5rem', borderRadius: 18,
                borderLeft: `1px solid ${r.color}25`,
                borderRight: `1px solid ${r.color}25`,
                borderBottom: `1px solid ${r.color}25`,
                borderTop: `4px solid ${r.color}`,
                background: `${r.color}08`,
                display: 'flex', flexDirection: 'column', gap: '1rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontSize: '1.4rem' }}>{r.icon}</span>
                    <span style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.15rem', color: r.color }}>{r.role}</span>
                  </div>
                  <Link href={r.href} style={{
                    fontFamily: 'var(--f-m)', fontSize: '0.75rem', color: r.color,
                    border: `1px solid ${r.color}40`, borderRadius: 999,
                    padding: '0.3rem 0.75rem', textDecoration: 'none',
                  }}>
                    Join free →
                  </Link>
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '0.5rem' }}>
                  {r.items.map(item => (
                    <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontFamily: 'var(--f-b)', fontSize: '0.9rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>
                      <span style={{ color: r.color, marginTop: '0.1rem', flexShrink: 0 }}>✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <style>{`
          @media (max-width: 768px) {
            .idx-roles-grid {
              display: flex !important; gap: 0.65rem !important;
              overflow-x: auto; scroll-snap-type: x mandatory;
              padding: 2px 1.25rem 6px; margin: 0 -1.25rem; -webkit-overflow-scrolling: touch;
              scrollbar-width: none;
            }
            .idx-roles-grid::-webkit-scrollbar { display: none; }
            .idx-role-card { scroll-snap-align: center; flex: 0 0 84%; }
          }
        `}</style>
      </section>

      {/* ── For artists ──────────────────────────────────────── */}
      <section style={{ padding: '2rem 0 3rem' }}>
        <div className="container">
          <div style={{
            background: 'linear-gradient(160deg, rgba(255,80,41,.08), transparent)',
            border: '1px solid rgba(255,80,41,.18)',
            borderRadius: 24,
            padding: 'clamp(2rem, 5vw, 3.5rem)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ maxWidth: '42ch', position: 'relative' }}>
              <p style={{ fontFamily: 'var(--f-m)', fontSize: '0.75rem', letterSpacing: '.2em', color: 'var(--accent)', textTransform: 'uppercase', margin: '0 0 0.6rem' }}>
                For artists
              </p>
              <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 'clamp(1.8rem, 4vw, 3rem)', letterSpacing: '-0.03em', color: 'var(--ink)', margin: '0 0 1rem', lineHeight: 1.06 }}>
                Your music. Your gate. Your fans.
              </h2>
              <p style={{ fontFamily: 'var(--f-b)', fontSize: '1.05rem', color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
                The 70% split to you is locked into our charter, before a single ticket sells. No agent required.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem', marginBottom: '1.5rem' }}>
                {['70% split · locked', 'Direct fan data', 'Zero ticket fees', 'Live show hosting', 'No agent needed'].map(chip => (
                  <span key={chip} style={{ fontFamily: 'var(--f-m)', fontSize: '0.76rem', color: 'var(--ink)', background: 'var(--hair-40)', border: '1px solid var(--hair-80)', borderRadius: 999, padding: '0.4rem 0.85rem' }}>
                    {chip}
                  </span>
                ))}
              </div>
              <Link
                href="/register?role=ARTIST"
                style={{
                  display: 'inline-block',
                  padding: '0.75rem 1.75rem', borderRadius: 12,
                  background: 'var(--accent)', color: '#fff',
                  fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '0.9rem',
                  textDecoration: 'none',
                }}
              >
                Join as an artist →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── The Split ────────────────────────────────────────── */}
      <section style={{ padding: '3rem 0' }}>
        <div className="container">
          <div style={{ marginBottom: '2rem' }}>
            <p style={{ fontFamily: 'var(--f-m)', fontSize: '0.75rem', letterSpacing: '.2em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
              The model
            </p>
            <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 'clamp(1.8rem, 4vw, 3rem)', letterSpacing: '-0.03em', color: 'var(--ink)', margin: 0 }}>
              Every ticket, every time.
            </h2>
          </div>

          {/* Split bar — 70% artist / 20% venue / 10% promoter / 0% iHYPE */}
          <div className="idx-split-bar" style={{ display: 'flex', height: 80, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ width: '70%', background: '#ff5029', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: 20, color: '#0a0805' }}>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.6rem' }}>70%</div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: '0.62rem', letterSpacing: '.08em' }}>ARTIST</div>
            </div>
            <div style={{ width: '20%', background: '#22e5d4', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: 18, color: '#0a0805' }}>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.5rem' }}>20%</div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: '0.62rem', letterSpacing: '.08em' }}>VENUE</div>
            </div>
            <div style={{ width: '10%', background: '#b983ff', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: 14, color: '#0a0805' }}>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.3rem' }}>10%</div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: '0.58rem', letterSpacing: '.06em' }}>PROMO</div>
            </div>
          </div>

          <div style={{ marginTop: '1rem', padding: '1rem 1.5rem', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--hair-25)', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--f-m)', fontSize: '0.8rem', color: 'var(--ink-3)', letterSpacing: '.06em', lineHeight: 1.6 }}>
              iHYPE → 0% · this is locked in our charter. Ticketmaster charges up to 27% on top of face value — the only charge here above face value is the card-processing fee, passed through at cost. <a href="/transparency" style={{ color: 'var(--ink-2)' }}>Read our transparency page →</a>
            </span>
          </div>
        </div>
      </section>

      {/* ── Trust comparison block ────────────────────────────── */}
      <section style={{ padding: '3rem 0' }}>
        <div className="container">
          <p style={{ fontFamily: 'var(--f-m)', fontSize: '0.75rem', letterSpacing: '.2em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
            The platform that takes nothing
          </p>
          <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 'clamp(1.8rem, 4vw, 3rem)', letterSpacing: '-0.03em', color: 'var(--ink)', margin: '0 0 2rem' }}>
            What iHYPE will never do.
          </h2>

          {/* Comparison table (desktop) / stacked practice cards (mobile —
              a table is unreadable on a phone even scrolled horizontally) */}
          <div className="idx-compare-table" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--f-b)', fontSize: '0.9rem' }}>
              <thead>
                <tr>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: '0.75rem', letterSpacing: '.1em', fontWeight: 400, borderBottom: '1px solid var(--hair-80)' }}>PRACTICE</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center', color: '#ff5029', fontFamily: 'var(--f-m)', fontSize: '0.75rem', letterSpacing: '.1em', fontWeight: 700, borderBottom: '1px solid var(--hair-80)' }}>Ticketmaster</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: '0.75rem', letterSpacing: '.1em', fontWeight: 400, borderBottom: '1px solid var(--hair-80)' }}>Spotify</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center', color: '#22e5d4', fontFamily: 'var(--f-m)', fontSize: '0.75rem', letterSpacing: '.1em', fontWeight: 700, borderBottom: '1px solid var(--hair-80)' }}>iHYPE</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map(([practice, tm, sp, ih]) => (
                  <tr key={practice} style={{ borderBottom: '1px solid var(--hair-40)' }}>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--ink-2)', lineHeight: 1.4 }}>{practice}</td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center', color: tm.startsWith('✗') ? '#ff5029' : 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: '0.8rem' }}>{tm}</td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center', color: sp.startsWith('✗') ? '#ff5029' : 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: '0.8rem' }}>{sp}</td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center', color: '#22e5d4', fontFamily: 'var(--f-m)', fontSize: '0.8rem', fontWeight: 700 }}>{ih}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="idx-compare-cards">
            <div className="idx-compare-head">
              <span>Ticketmaster</span>
              <span>Spotify</span>
              <span className="idx-compare-head-ihype">iHYPE</span>
            </div>
            {COMPARISON_ROWS.map(([practice, tm, sp, ih]) => (
              <div className="idx-compare-card" key={practice}>
                <div className="idx-compare-practice">{practice}</div>
                <div className="idx-compare-row">
                  <div className={`idx-compare-cell${tm.startsWith('✗') ? ' bad' : ' neutral'}`}>{tm.replace(/^[✗✓] /, '')}</div>
                  <div className={`idx-compare-cell${sp.startsWith('✗') ? ' bad' : ' neutral'}`}>{sp.replace(/^[✗✓] /, '')}</div>
                  <div className="idx-compare-cell good">{ih.replace(/^[✗✓] /, '')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <style>{`
          .idx-compare-cards { display: none; }
          @media (max-width: 768px) {
            .idx-compare-table { display: none; }
            .idx-compare-cards { display: block; }
            .idx-compare-head {
              display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px;
              padding: 0 4px 6px; margin-bottom: 2px;
            }
            .idx-compare-head span {
              font-family: var(--f-m); font-size: 8px; letter-spacing: .06em; text-transform: uppercase;
              color: var(--ink-3); text-align: center;
            }
            .idx-compare-head-ihype { color: #22e5d4 !important; font-weight: 700; }
            .idx-compare-card {
              border: 1px solid var(--hair-80); border-radius: 14px; padding: 14px 16px; margin-bottom: 8px;
              display: flex; flex-direction: column; gap: 10px;
            }
            .idx-compare-practice { font-family: var(--f-b); font-size: 13px; color: var(--ink); font-weight: 500; line-height: 1.4; }
            .idx-compare-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
            .idx-compare-cell {
              border-radius: 8px; padding: 7px 4px; text-align: center;
              background: var(--hair-30); font-family: var(--f-m); font-size: 10.5px; font-weight: 700;
            }
            .idx-compare-cell.bad { color: #ff5029; }
            .idx-compare-cell.good { color: #22e5d4; }
            .idx-compare-cell.neutral { color: var(--ink-3); font-weight: 400; }
          }
        `}</style>
      </section>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <section style={{ padding: '4rem 0' }}>
        <div className="container">
          <div style={{
            padding: 'clamp(2rem, 5vw, 4rem)',
            borderRadius: 28,
            border: '1px solid rgba(255,80,41,.22)',
            background: 'linear-gradient(135deg, rgba(255,80,41,.1) 0%, rgba(255,62,154,.06) 50%, transparent 100%)',
            boxShadow: '0 8px 48px rgba(255,80,41,.1)',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--accent), #ff3e9a, #b983ff)' }} />
            <p style={{ fontFamily: 'var(--f-m)', fontSize: '0.75rem', letterSpacing: '.2em', color: 'var(--accent)', textTransform: 'uppercase', margin: '0 0 0.75rem' }}>
              Completely free
            </p>
            <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 'clamp(2rem, 5vw, 4rem)', letterSpacing: '-0.04em', color: 'var(--ink)', margin: '0 0 1rem', lineHeight: 1 }}>
              Join your scene.
            </h2>
            <p style={{ fontFamily: 'var(--f-b)', fontSize: '1rem', color: 'var(--ink-2)', margin: '0 0 2rem', maxWidth: '44ch', marginInline: 'auto', lineHeight: 1.65 }}>
              No subscription. No fees. Just music, community, and a platform that&apos;s actually on your side.
            </p>
            <Link
              href="/register"
              style={{
                display: 'inline-block',
                padding: '0.9rem 2.5rem', borderRadius: 999,
                background: 'var(--accent)',
                color: '#fff',
                fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: '1.05rem',
                textDecoration: 'none',
              }}
            >
              Join Beta →
            </Link>
            <div style={{ marginTop: '1.25rem' }}>
              <Link href="/login" style={{ fontFamily: 'var(--f-b)', fontSize: '0.9rem', color: 'var(--ink-3)', textDecoration: 'none' }}>
                Already have an account? <span style={{ color: 'var(--ink-2)', textDecoration: 'underline' }}>Sign in</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <PiAdminButton />
      <IndexStickyCta heroSelector=".idx-hero-section" />
    </div>
  );
}
