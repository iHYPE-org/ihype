import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PiAdminButton } from '@/components/PiAdminButton';
import { db } from '@/lib/db';

export const metadata = {
  title: 'iHYPE — Independent music built for the scene',
  description: 'Not-for-profit music discovery for artists, promoters, venues, and fans. 0% ticket fees. Free forever.',
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
      <section style={{ padding: 'clamp(4rem, 10vw, 8rem) 0 3rem', position: 'relative' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '3rem', alignItems: 'center' }}>
            <div>
              {/* Live stats bar */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {[
                  { value: fmt(artistCount), label: 'artists' },
                  { value: fmt(fanCount), label: 'fans' },
                  { value: fmt(totalHypes), label: 'hypes' },
                  { value: fmt(showCount), label: 'shows live' },
                ].map((s, i) => (
                  <div key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.3rem 0.75rem', borderRadius: 999,
                    border: '1px solid rgba(255,255,255,.08)',
                    background: 'rgba(255,255,255,.04)',
                  }}>
                    <span style={{ fontFamily: 'var(--f-m)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent)' }}>{s.value}</span>
                    <span style={{ fontFamily: 'var(--f-m)', fontSize: '0.75rem', color: 'var(--ink-3)', letterSpacing: '.04em' }}>{s.label}</span>
                  </div>
                ))}
              </div>

              <h1 style={{
                fontFamily: 'var(--f-d)',
                fontWeight: 800,
                fontSize: 'clamp(3rem, 8vw, 6.5rem)',
                lineHeight: 0.93,
                letterSpacing: '-0.04em',
                margin: '0 0 1.5rem',
                color: 'var(--ink)',
              }}>
                Independent<br />
                music built<br />
                <span style={{
                  background: 'linear-gradient(90deg, var(--accent), #ff3e9a)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>for the scene.</span>
              </h1>
              <p style={{
                fontFamily: 'var(--f-b)',
                fontSize: 'clamp(1rem, 2vw, 1.2rem)',
                color: 'var(--ink-2)',
                maxWidth: '52ch',
                lineHeight: 1.65,
                margin: '0 0 2rem',
              }}>
                Zero fees. 45% to the artist, 45% to the venue, 10% to whoever
                brought the fan. iHYPE takes nothing — and that&apos;s locked in.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <Link
                  href="/app"
                  style={{
                    display: 'inline-block',
                    padding: '0.65rem 1.5rem', borderRadius: 999,
                    border: '1px solid rgba(255,80,41,.4)',
                    background: 'rgba(255,80,41,.08)',
                    color: 'var(--accent)',
                    fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: '0.9rem',
                    textDecoration: 'none',
                  }}
                >
                  Try the fan app →
                </Link>
                <Link href="/login" style={{ fontFamily: 'var(--f-b)', fontSize: '0.9rem', color: 'var(--ink-3)', textDecoration: 'none' }}>
                  Already have an account? <span style={{ color: 'var(--ink-2)', textDecoration: 'underline' }}>Sign in</span>
                </Link>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ── For who? ─────────────────────────────────────────── */}
      <section style={{ padding: '3rem 0' }}>
        <div className="container">
          <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 'clamp(1.8rem, 4vw, 3rem)', letterSpacing: '-0.03em', color: 'var(--ink)', margin: '0 0 1.5rem' }}>
            Built for everyone in the room.
          </h2>
          <div className="grid grid-2" style={{ gap: '0.75rem' }}>
            {[
              { role: 'Fans', color: '#b983ff', icon: '🎶', href: '/register?role=FAN', items: ['Discover new music before it blows up', 'Buy tickets with no fees', 'Earn 10% on tickets you refer', 'Track your scene with hype streaks'] },
              { role: 'Artists', color: '#ff5029', icon: '🎸', href: '/register?role=ARTIST', items: ['45% of every ticket you sell', 'Upload music as swipeable Seeds', 'Build your public page and catalog', 'See who\'s hyping your work'] },
              { role: 'Venues', color: '#22e5d4', icon: '🏟️', href: '/register?role=VENUE', items: ['45% of every show you host', 'Zero ticketing fees for buyers', 'Demand radar shows what\'s trending', 'Connect with artists and promoters'] },
              { role: 'Promoters / DJs', color: '#ffb84a', icon: '📣', href: '/register?role=DJ', items: ['10% referral on every ticket you drive', 'Host radio shows on the platform', 'Build a following and grow your scene', 'Referral links for every event'] },
            ].map(r => (
              <div key={r.role} style={{
                padding: '1.5rem', borderRadius: 18,
                border: `1px solid ${r.color}25`,
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
      </section>

      {/* ── The Split ────────────────────────────────────────── */}
      <section style={{ padding: '3rem 0' }}>
        <div className="container">
          <div style={{ marginBottom: '2rem' }}>
            <p style={{ fontFamily: 'var(--f-m)', fontSize: '0.75rem', letterSpacing: '.2em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
              The 45/45/10 promise
            </p>
            <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 'clamp(1.8rem, 4vw, 3rem)', letterSpacing: '-0.03em', color: 'var(--ink)', margin: 0 }}>
              Every ticket sale. Every time.
            </h2>
            <p style={{ fontFamily: 'var(--f-b)', fontSize: '1rem', color: 'var(--ink-2)', marginTop: '0.75rem', maxWidth: '56ch', lineHeight: 1.6 }}>
              Ticketmaster charges up to 27% on top of face value. We charge zero.
              Our code is open, our split is fixed, and we never change it.
            </p>
          </div>

          <div className="grid grid-3" style={{ gap: '1rem' }}>
            {[
              { pct: '45%', role: 'Artist', color: '#ff5029', desc: 'Per ticket sold at your show. No deductions, no hidden processing cuts. Paid out automatically.', icon: '🎸' },
              { pct: '45%', role: 'Venue', color: '#22e5d4', desc: 'Per ticket for hosting the show. The room makes money too — not just the act on stage.', icon: '🏟️' },
              { pct: '10%', role: 'Promoter', color: '#b983ff', desc: 'To whoever brought the fan — DJ, promoter, or friend with a referral link. Grow the scene, get paid.', icon: '📣' },
            ].map(c => (
              <div key={c.role} style={{
                padding: '1.75rem', borderRadius: 20,
                border: `1px solid ${c.color}30`,
                background: `linear-gradient(135deg, ${c.color}10, transparent)`,
                boxShadow: `0 4px 24px ${c.color}12`,
                display: 'grid', gap: '0.75rem',
              }}>
                <div style={{ fontSize: '2rem', lineHeight: 1 }}>{c.icon}</div>
                <div>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '3rem', letterSpacing: '-0.03em', color: c.color, lineHeight: 1 }}>{c.pct}</div>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--ink)', marginTop: '0.25rem' }}>{c.role}</div>
                </div>
                <p style={{ fontFamily: 'var(--f-b)', fontSize: '0.9rem', color: 'var(--ink-2)', lineHeight: 1.6, margin: 0 }}>{c.desc}</p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '1rem', padding: '1rem 1.5rem', borderRadius: 14, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.025)', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--f-m)', fontSize: '0.8rem', color: 'var(--ink-3)', letterSpacing: '.06em' }}>
              iHYPE → 0% · this is locked in our charter · <a href="/transparency" style={{ color: 'var(--ink-2)' }}>read our transparency page →</a>
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

          {/* Comparison table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--f-b)', fontSize: '0.9rem' }}>
              <thead>
                <tr>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: '0.75rem', letterSpacing: '.1em', fontWeight: 400, borderBottom: '1px solid rgba(255,255,255,.08)' }}>PRACTICE</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center', color: '#ff5029', fontFamily: 'var(--f-m)', fontSize: '0.75rem', letterSpacing: '.1em', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,.08)' }}>Ticketmaster</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: '0.75rem', letterSpacing: '.1em', fontWeight: 400, borderBottom: '1px solid rgba(255,255,255,.08)' }}>Spotify</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center', color: '#22e5d4', fontFamily: 'var(--f-m)', fontSize: '0.75rem', letterSpacing: '.1em', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,.08)' }}>iHYPE</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Service fees on tickets', '✗ up to 27%', '—', '✓ 0%'],
                  ['Dynamic / surge pricing', '✗ yes', '—', '✓ never'],
                  ['Payola / pay-to-play algorithms', '—', '✗ yes', '✓ never'],
                  ['Takes a cut of artist revenue', '—', '✗ ~70% kept', '✓ 0%'],
                  ['Sells fan data to advertisers', '✗ yes', '✗ yes', '✓ never'],
                  ['Locks artists into exclusivity', '✗ some deals', '✗ some deals', '✓ no lock-in'],
                  ['Charges for platform access', '✗ yes', '✗ yes', '✓ free forever'],
                ].map(([practice, tm, sp, ih]) => (
                  <tr key={practice} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--ink-2)', lineHeight: 1.4 }}>{practice}</td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center', color: tm.startsWith('✗') ? '#ff5029' : 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: '0.8rem' }}>{tm}</td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center', color: sp.startsWith('✗') ? '#ff5029' : 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: '0.8rem' }}>{sp}</td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center', color: '#22e5d4', fontFamily: 'var(--f-m)', fontSize: '0.8rem', fontWeight: 700 }}>{ih}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section style={{ padding: '3rem 0' }}>
        <div className="container">
          <p style={{ fontFamily: 'var(--f-m)', fontSize: '0.75rem', letterSpacing: '.2em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
            What&apos;s inside
          </p>
          <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 'clamp(1.8rem, 4vw, 3rem)', letterSpacing: '-0.03em', color: 'var(--ink)', margin: '0 0 2rem' }}>
            One platform, four tools.
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            {[
              { name: 'Seeds', icon: '🌱', color: '#ff5029', tagline: 'Swipe music discovery', desc: 'Hear 30-second previews from artists near you. Swipe right to hype, left to skip, up to save. Every swipe feeds real demand data back to artists and venues — no black-box algorithm.' },
              { name: 'Radio', icon: '📻', color: '#22e5d4', tagline: 'Artist-curated streams', desc: 'Live and on-demand radio shows hosted by the artists and promoters who know the scene. No AI playlists, no payola — just people programming music they actually care about.' },
              { name: 'Ticketing', icon: '🎟️', color: '#b983ff', tagline: '0% fees, face value only', desc: 'Buy and sell tickets at the price the artist set. No service charges, no hidden fees, no dynamic pricing. Your QR code is yours — not tied to a corporate app.' },
              { name: 'Studio', icon: '🎛️', color: '#ffb84a', tagline: 'Your page, your tools', desc: 'Artists, venues, and promoters get a full public profile: upload media, set your top 5, schedule shows, manage your seeds catalog, and track your earnings — all in one workbench.' },
            ].map(f => (
              <div key={f.name} className="card" style={{ padding: '1.5rem', display: 'grid', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{f.icon}</span>
                  <div>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.1rem', color: f.color }}>{f.name}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: '0.72rem', color: 'var(--ink-3)', letterSpacing: '.08em', textTransform: 'uppercase' }}>{f.tagline}</div>
                  </div>
                </div>
                <p style={{ fontFamily: 'var(--f-b)', fontSize: '0.88rem', color: 'var(--ink-2)', lineHeight: 1.65, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What's a HYPE? ───────────────────────────────────── */}
      <section style={{ padding: '2rem 0 3rem' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'start' }}>
            {/* Left: intro */}
            <div>
              <p style={{ fontFamily: 'var(--f-m)', fontSize: '0.75rem', letterSpacing: '.2em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                THE MECHANIC
              </p>
              <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 'clamp(1.8rem, 4vw, 3rem)', letterSpacing: '-0.03em', color: 'var(--ink)', margin: '0 0 1.25rem' }}>
                What&apos;s a HYPE?
              </h2>
              <p style={{ fontFamily: 'var(--f-b)', fontSize: '1.05rem', lineHeight: 1.6, color: 'rgba(240,235,229,.72)', maxWidth: '38ch', margin: '0 0 1.5rem' }}>
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
                <div key={step.num} style={{ display: 'flex', gap: 16, padding: 18, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10 }}>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 18, flexShrink: 0, width: 28, color: step.color }}>{step.num}</div>
                  <div>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 4 }}>{step.name}</div>
                    <p style={{ fontFamily: 'var(--f-b)', fontSize: 13, lineHeight: 1.5, color: 'rgba(240,235,229,.5)', margin: 0 }}>{step.desc}</p>
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
              Free forever
            </p>
            <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 'clamp(2rem, 5vw, 4rem)', letterSpacing: '-0.04em', color: 'var(--ink)', margin: '0 0 1rem', lineHeight: 1 }}>
              Join the scene.
            </h2>
            <p style={{ fontFamily: 'var(--f-b)', fontSize: '1rem', color: 'var(--ink-2)', margin: '0 0 2rem', maxWidth: '44ch', marginInline: 'auto', lineHeight: 1.65 }}>
              No subscription. No fees. Just music, community, and a platform that&apos;s actually on your side.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
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
                Get started free →
              </Link>
              <Link
                href="/app"
                style={{
                  display: 'inline-block',
                  padding: '0.9rem 2.5rem', borderRadius: 999,
                  border: '1px solid rgba(255,80,41,.35)',
                  background: 'rgba(255,80,41,.07)',
                  color: 'var(--accent)',
                  fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: '1.05rem',
                  textDecoration: 'none',
                }}
              >
                Try the fan app
              </Link>
            </div>
            <div style={{ marginTop: '1.25rem' }}>
              <Link href="/login" style={{ fontFamily: 'var(--f-b)', fontSize: '0.9rem', color: 'var(--ink-3)', textDecoration: 'none' }}>
                Already have an account? <span style={{ color: 'var(--ink-2)', textDecoration: 'underline' }}>Sign in</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <PiAdminButton />
    </div>
  );
}
