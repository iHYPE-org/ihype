import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Welcome to iHYPE',
  robots: { index: false, follow: false },
};

const ROLE_DESTINATIONS: Record<string, { href: string; label: string }> = {
  FAN: { href: '/home', label: 'Go to your feed' },
  ARTIST: { href: '/home', label: 'Go to your dashboard' },
  VENUE: { href: '/home', label: 'Go to your dashboard' },
  DJ: { href: '/home', label: 'Go to your dashboard' },
  PROMOTER: { href: '/home', label: 'Go to your dashboard' },
};

const ROLE_STEPS: Record<string, { title: string; desc: string }[]> = {
  FAN: [
    { title: 'Discover music', desc: 'Seeds shows you 30-sec previews. Swipe right to hype, left to skip.' },
    { title: 'Buy tickets', desc: '$0 fees, always. Face value is the only price you pay.' },
    { title: 'Share & earn', desc: 'Copy your referral link. Earn 10% of every ticket you drive.' },
  ],
  ARTIST: [
    { title: 'Create your first show', desc: 'Studio → New Show. Set a price, publish, split is locked.' },
    { title: 'Upload tracks to Seeds', desc: 'Your tracks become swipeable discovery cards for fans.' },
    { title: 'Watch the demand radar', desc: 'See which cities are hyping your music before you book.' },
  ],
  VENUE: [
    { title: 'Complete your page', desc: 'Add your venue details, capacity, and location.' },
    { title: 'Book from the radar', desc: 'See which artists have demand in your city.' },
    { title: 'Host a show', desc: 'Partner with an artist — 45% is yours, automatically.' },
  ],
  DJ: [
    { title: 'Build your crate', desc: 'Browse free-use tracks. Only cleared music in your sets.' },
    { title: 'Schedule a show', desc: 'Radio Studio → New Show. Go live or schedule ahead.' },
    { title: 'Share your link', desc: 'Earn 10% of every ticket you drive to shows you promote.' },
  ],
};

export default async function WelcomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/register');

  const role = (session.user as { role?: string }).role ?? 'FAN';
  const dest = ROLE_DESTINATIONS[role] ?? ROLE_DESTINATIONS.FAN;
  const steps = ROLE_STEPS[role] ?? ROLE_STEPS.FAN;
  const name = session.user.name ?? 'there';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg, #0a0805)',
      color: 'var(--ink, #f0ebe5)',
      fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
      padding: 24,
    }}>
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <div style={{
          fontFamily: "var(--font-display, 'Syne', sans-serif)",
          fontWeight: 800,
          fontSize: '2.8rem',
          letterSpacing: '-0.04em',
          color: 'var(--accent, #ff5029)',
          marginBottom: 24,
        }}>
          iH·YPE
        </div>

        <h1 style={{
          fontFamily: "var(--font-display, 'Syne', sans-serif)",
          fontWeight: 800,
          fontSize: 'clamp(1.8rem, 5vw, 2.4rem)',
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          margin: '0 0 16px',
        }}>
          Welcome, {name}.
        </h1>

        <p style={{
          fontSize: '1rem',
          lineHeight: 1.65,
          color: 'var(--ink-2, #9e9080)',
          margin: '0 0 12px',
        }}>
          You&apos;re in. iHYPE takes 0% of every ticket sale — 45% goes to the artist, 45% to the venue, 10% to the promoter pool.
        </p>

        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 32, margin: '20px 0 28px' }}>
          <div style={{ flex: 45, background: 'var(--role-artist, #ff5029)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", fontWeight: 600, fontSize: '0.68rem', letterSpacing: '0.06em', color: '#0a0805' }}>
            ARTIST 45%
          </div>
          <div style={{ flex: 45, background: 'var(--role-venue, #22e5d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", fontWeight: 600, fontSize: '0.68rem', letterSpacing: '0.06em', color: '#0a0805' }}>
            VENUE 45%
          </div>
          <div style={{ flex: 10, background: 'var(--role-promoter, #ffb84a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", fontWeight: 600, fontSize: '0.6rem', letterSpacing: '0.04em', color: '#0a0805' }}>
            10%
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28, textAlign: 'left' }}>
          {steps.map((step, i) => (
            <div
              key={step.title}
              style={{
                display: 'flex',
                gap: 14,
                alignItems: 'flex-start',
                padding: '16px 18px',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10,
                background: 'var(--bg2, #100d09)',
              }}
            >
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'rgba(255,80,41,0.15)',
                color: 'var(--accent, #ff5029)',
                fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                fontSize: '0.75rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {i + 1}
              </div>
              <div>
                <h3 style={{
                  fontFamily: "var(--font-display, 'Syne', sans-serif)",
                  fontSize: '0.92rem',
                  fontWeight: 800,
                  marginBottom: 3,
                }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--ink-2, #9e9080)', lineHeight: 1.5 }}>
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <Link
          href={dest.href}
          style={{
            display: 'block',
            background: 'var(--accent, #ff5029)',
            color: '#fff',
            borderRadius: 9999,
            padding: '14px 28px',
            fontFamily: "var(--font-display, 'Syne', sans-serif)",
            fontWeight: 800,
            fontSize: '1rem',
            textDecoration: 'none',
            letterSpacing: '-0.01em',
          }}
        >
          {dest.label}
        </Link>

        <p style={{ marginTop: 16, fontSize: '0.82rem', color: 'var(--ink-3, #5a5048)' }}>
          Questions? <a href="mailto:admin@ihype.org" style={{ color: 'var(--ink-2)' }}>admin@ihype.org</a>
        </p>
      </div>
    </div>
  );
}
