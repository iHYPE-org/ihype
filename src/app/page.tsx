import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const metadata = {
  title: 'iHYPE — Independent music built for the scene',
  description: 'Not-for-profit music discovery for artists, promoters, venues, and fans. 0% ticket fees. Free forever.',
};

export default async function RootPage() {
  const session = await auth();
  if (session?.user?.id) redirect('/home');

  return (
    <div style={{ paddingBottom: '6rem' }}>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(4rem, 10vw, 8rem) 0 3rem', position: 'relative' }}>
        <div className="container" style={{ display: 'grid', gap: '2rem' }}>
          <div>
            <span className="badge" style={{ marginBottom: '1.25rem' }}>
              Not for profit · 0% platform fees · Free forever
            </span>
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
              The platform that sends every dollar to the people who deserve it —
              artists, venues, and the fans who fill the room. We take nothing.
            </p>
          </div>

          {/* CTA row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            <Link href="/register" className="button" style={{ fontSize: '1rem', padding: '0.85rem 2rem' }}>
              Join free
            </Link>
            <Link href="/login" className="button secondary" style={{ fontSize: '1rem', padding: '0.85rem 1.5rem' }}>
              Sign in →
            </Link>
          </div>

          {/* The 45/45/10 pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.5rem' }}>
            {[
              { pct: '45%', label: 'to the artist', color: '#ff5029' },
              { pct: '45%', label: 'to the venue', color: '#22e5d4' },
              { pct: '10%', label: 'to whoever brought the fan', color: '#b983ff' },
              { pct: '0%',  label: 'to iHYPE', color: 'var(--ink-3)', dim: true },
            ].map(p => (
              <div key={p.label} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.45rem 0.9rem', borderRadius: 999,
                border: `1px solid ${p.dim ? 'rgba(255,255,255,.08)' : p.color + '35'}`,
                background: p.dim ? 'rgba(255,255,255,.03)' : p.color + '12',
                opacity: p.dim ? 0.6 : 1,
              }}>
                <span style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.05rem', color: p.dim ? 'var(--ink-3)' : p.color }}>{p.pct}</span>
                <span style={{ fontFamily: 'var(--f-m)', fontSize: '0.75rem', color: p.dim ? 'var(--ink-3)' : 'var(--ink-2)', letterSpacing: '.04em' }}>{p.label}</span>
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
              {
                pct: '45%', role: 'Artist', color: '#ff5029',
                desc: 'Per ticket sold at your show. No deductions, no hidden processing cuts. Paid out automatically.',
                icon: '🎸',
              },
              {
                pct: '45%', role: 'Venue', color: '#22e5d4',
                desc: 'Per ticket for hosting the show. The room makes money too — not just the act on stage.',
                icon: '🏟️',
              },
              {
                pct: '10%', role: 'Promoter', color: '#b983ff',
                desc: 'To whoever brought the fan — DJ, promoter, or friend with a referral link. Grow the scene, get paid.',
                icon: '📣',
              },
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

          <div style={{
            marginTop: '1rem', padding: '1rem 1.5rem', borderRadius: 14,
            border: '1px solid rgba(255,255,255,.06)',
            background: 'rgba(255,255,255,.025)',
            display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
          }}>
            <span style={{ fontFamily: 'var(--f-m)', fontSize: '0.8rem', color: 'var(--ink-3)', letterSpacing: '.06em' }}>iHYPE → 0% · this is locked in our charter · <a href="/transparency" style={{ color: 'var(--ink-2)' }}>read our transparency page →</a></span>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section style={{ padding: '3rem 0' }}>
        <div className="container">
          <p style={{ fontFamily: 'var(--f-m)', fontSize: '0.75rem', letterSpacing: '.2em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
            What's inside
          </p>
          <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 'clamp(1.8rem, 4vw, 3rem)', letterSpacing: '-0.03em', color: 'var(--ink)', margin: '0 0 2rem' }}>
            One platform, four tools.
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            {[
              {
                name: 'Seeds',
                icon: '🌱',
                color: '#ff5029',
                tagline: 'Swipe music discovery',
                desc: 'Hear 30-second previews from artists near you. Swipe right to hype, left to skip, up to save. Every swipe feeds real demand data back to artists and venues — no black-box algorithm.',
              },
              {
                name: 'Radio',
                icon: '📻',
                color: '#22e5d4',
                tagline: 'Artist-curated streams',
                desc: 'Live and on-demand radio shows hosted by the artists and promoters who know the scene. No AI playlists, no payola — just people programming music they actually care about.',
              },
              {
                name: 'Ticketing',
                icon: '🎟️',
                color: '#b983ff',
                tagline: '0% fees, face value only',
                desc: 'Buy and sell tickets at the price the artist set. No service charges, no hidden fees, no dynamic pricing. Your QR code is yours — not tied to a corporate app.',
              },
              {
                name: 'Studio',
                icon: '🎛️',
                color: '#ffb84a',
                tagline: 'Your page, your tools',
                desc: 'Artists, venues, and promoters get a full public profile: upload media, set your top 5, schedule shows, manage your seeds catalog, and track your earnings — all in one workbench.',
              },
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

      {/* ── For who? ─────────────────────────────────────────── */}
      <section style={{ padding: '3rem 0' }}>
        <div className="container">
          <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 'clamp(1.8rem, 4vw, 3rem)', letterSpacing: '-0.03em', color: 'var(--ink)', margin: '0 0 1.5rem' }}>
            Built for everyone in the room.
          </h2>
          <div className="grid grid-2" style={{ gap: '0.75rem' }}>
            {[
              { role: 'Fans', color: '#b983ff', icon: '🎶', items: ['Discover new music before it blows up', 'Buy tickets with no fees', 'Earn 10% on tickets you refer', 'Track your scene with hype streaks'] },
              { role: 'Artists', color: '#ff5029', icon: '🎸', items: ['45% of every ticket you sell', 'Upload music as swipeable Seeds', 'Build your public page and catalog', 'See who\'s hyping your work'] },
              { role: 'Venues', color: '#22e5d4', icon: '🏟️', items: ['45% of every show you host', 'Zero ticketing fees for buyers', 'Demand radar shows what\'s trending', 'Connect with artists and promoters'] },
              { role: 'Promoters / DJs', color: '#ffb84a', icon: '📣', items: ['10% referral on every ticket you drive', 'Host radio shows on the platform', 'Build a following and grow your scene', 'Referral links for every event'] },
            ].map(r => (
              <div key={r.role} style={{
                padding: '1.5rem', borderRadius: 18,
                border: `1px solid ${r.color}25`,
                background: `${r.color}08`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '1.4rem' }}>{r.icon}</span>
                  <span style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.15rem', color: r.color }}>{r.role}</span>
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
              No subscription. No fees. Just music, community, and a platform that's actually on your side.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <Link href="/register" className="button" style={{ fontSize: '1rem', padding: '0.9rem 2.5rem' }}>
                Create free account
              </Link>
              <Link href="/login" className="button secondary" style={{ fontSize: '1rem', padding: '0.9rem 1.5rem' }}>
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
