import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export const metadata: Metadata = {
  title: 'Welcome · iHYPE',
  robots: { index: false, follow: false },
};

type Role = 'FAN' | 'ARTIST' | 'VENUE' | 'DJ';

const STEPS: Record<Role, { n: number; title: string; desc: string }[]> = {
  FAN: [
    { n: 1, title: 'Discover music', desc: 'Seeds shows you 30-sec previews. Swipe right to hype, left to skip.' },
    { n: 2, title: 'Buy tickets', desc: '$0 fees, always. Face value is the only price you pay.' },
    { n: 3, title: 'Share & earn', desc: 'Share your HYPE Link. Earn 10% of every ticket you drive.' },
  ],
  ARTIST: [
    { n: 1, title: 'Create your first show', desc: 'Events → New Show. Set a price, publish, split is locked.' },
    { n: 2, title: 'Upload tracks to Seeds', desc: 'Your tracks become swipeable discovery cards for fans.' },
    { n: 3, title: 'Watch the demand radar', desc: 'See which cities are hyping your music before you book.' },
  ],
  VENUE: [
    { n: 1, title: 'Complete your page', desc: 'Add your venue details, capacity, and location.' },
    { n: 2, title: 'Book from the radar', desc: 'See which artists have demand in your city.' },
    { n: 3, title: 'Host a show', desc: 'Partner with an artist — 45% is yours, automatically.' },
  ],
  DJ: [
    { n: 1, title: 'Build your crate', desc: 'Browse free-use tracks. Only cleared music in your sets.' },
    { n: 2, title: 'Schedule a show', desc: 'WebRadio → Schedule. Go live or schedule ahead.' },
    { n: 3, title: 'Share your link', desc: 'Earn 10% of every ticket you drive to shows you promote.' },
  ],
};

const PREVIEW: Record<Role, {
  sub: string; color: string; border: string; bg: string; art: string;
  icon: ReactElement; eyebrow: string; title: string; sub2: string; cta: string; href: string;
}> = {
  FAN: {
    sub: 'A show near you, and an artist worth following — picked from your genres.',
    color: '#ff5029', border: 'rgba(255,80,41,.25)', bg: 'rgba(255,80,41,.06)',
    art: 'linear-gradient(135deg,#ff5029,#b983ff)',
    icon: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
    eyebrow: 'SUGGESTED FOR YOU', title: 'Alex Rivera · Deep House', sub2: 'Playing The Fillmore, SF · Jul 4',
    cta: 'View artist', href: '/discover',
  },
  ARTIST: {
    sub: 'Your public artist page is already live — here’s what fans will see.',
    color: '#ff5029', border: 'rgba(255,80,41,.25)', bg: 'rgba(255,80,41,.06)',
    art: 'linear-gradient(135deg,#ff5029,#b983ff)',
    icon: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
    eyebrow: 'YOUR PAGE IS LIVE', title: 'Your Artist Page', sub2: '45% split locked in · 0 tracks uploaded yet',
    cta: 'Create a show', href: '/events/new',
  },
  VENUE: {
    sub: 'Three artists are already hyping near your room — here’s the top match.',
    color: '#22e5d4', border: 'rgba(34,229,212,.25)', bg: 'rgba(34,229,212,.06)',
    art: 'linear-gradient(135deg,#22e5d4,#5b8cff)',
    icon: <><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /><path d="M9 9v.01M9 12v.01M9 15v.01" /></>,
    eyebrow: 'DEMAND NEAR YOU', title: 'Luna Park · Indie', sub2: '312 hypes from fans within 20mi',
    cta: 'See demand radar', href: '/listen',
  },
  DJ: {
    sub: 'Your crate is ready — schedule your first show to start building an audience.',
    color: '#ff3e9a', border: 'rgba(255,62,154,.25)', bg: 'rgba(255,62,154,.06)',
    art: 'linear-gradient(135deg,#ff3e9a,#ffb84a)',
    icon: <><path d="M4 14a8 8 0 0 1 16 0" /><path d="M4 14v4a2 2 0 0 0 2 2h1v-6H6a2 2 0 0 0-2 2Z" /><path d="M20 14v4a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2Z" /></>,
    eyebrow: 'YOUR CRATE', title: 'Cleared tracks ready to play', sub2: '0 tracks added · browse the library',
    cta: 'Go to Radio', href: '/radio',
  },
};

export default async function WelcomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/register');

  const sessionRole = (session.user as { role?: string }).role;
  const role: Role = sessionRole === 'ARTIST' || sessionRole === 'VENUE' || sessionRole === 'DJ' ? sessionRole : 'FAN';
  const steps = STEPS[role];
  const p = PREVIEW[role];

  return (
    <div className="welcome-body">
      <div className="welcome-card">
        <div className="welcome-wordmark">i<span>HYPE</span></div>
        <span className="welcome-confetti">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="#ff5029" stroke="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
        </span>
        <h1 className="welcome-h1">You&apos;re <span>in</span>.</h1>
        <p className="welcome-sub">{p.sub}</p>

        <div className="welcome-preview" style={{ borderColor: p.border, background: p.bg }}>
          <div className="welcome-preview-art" style={{ background: p.art }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{p.icon}</svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="welcome-preview-eyebrow" style={{ color: p.color }}>{p.eyebrow}</div>
            <div className="welcome-preview-title">{p.title}</div>
            <div className="welcome-preview-sub">{p.sub2}</div>
          </div>
          <Link className="welcome-preview-go" href={p.href} style={{ background: p.color }}>{p.cta} →</Link>
        </div>

        <div className="welcome-steps">
          {steps.map((s) => (
            <div className="welcome-step" key={s.n}>
              <div className="welcome-step-num">{s.n}</div>
              <div className="welcome-step-text">
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <Link className="welcome-cta" href="/listen">Go to Listen →</Link>
        <Link className="welcome-skip" href="/listen">Explore later</Link>
      </div>

      <style>{`
        .welcome-body { background: var(--bg); display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
        .welcome-card { max-width: 540px; width: 100%; text-align: center; }
        .welcome-wordmark { font-family: var(--f-d, 'Syne', sans-serif); font-size: 28px; font-weight: 800; letter-spacing: -.02em; margin-bottom: 48px; color: var(--ink); }
        .welcome-wordmark span { color: var(--accent); }
        .welcome-confetti { width: 56px; height: 56px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center; border-radius: 16px; background: rgba(255,80,41,.12); }
        .welcome-h1 { font-family: var(--f-d, 'Syne', sans-serif); font-size: 36px; font-weight: 800; letter-spacing: -.02em; line-height: .95; margin-bottom: 16px; color: var(--ink); }
        .welcome-h1 span { color: var(--accent); }
        .welcome-sub { font-size: 15px; color: var(--ink-a70); margin-bottom: 24px; line-height: 1.6; }
        .welcome-preview { display: flex; align-items: center; gap: 14px; text-align: left; padding: 16px 18px; border-radius: 12px; margin-bottom: 28px; border: 1px solid; }
        .welcome-preview-art { width: 52px; height: 52px; border-radius: 12px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #fff; }
        .welcome-preview-eyebrow { font-family: var(--f-m, 'JetBrains Mono', monospace); font-size: 9px; letter-spacing: .14em; text-transform: uppercase; margin-bottom: 4px; }
        .welcome-preview-title { font-family: var(--f-d, 'Syne', sans-serif); font-size: 16px; font-weight: 800; letter-spacing: -.01em; margin-bottom: 2px; color: var(--ink); }
        .welcome-preview-sub { font-size: 12px; color: var(--ink-a55); }
        .welcome-preview-go { flex-shrink: 0; font-family: var(--f-d, 'Syne', sans-serif); font-weight: 800; font-size: 12px; padding: 9px 14px; border-radius: 8px; color: #0a0805; text-decoration: none; white-space: nowrap; }
        .welcome-steps { display: flex; flex-direction: column; gap: 16px; margin-bottom: 48px; text-align: left; }
        .welcome-step { display: flex; gap: 16px; align-items: flex-start; padding: 18px 20px; border: 1px solid var(--line); border-radius: 10px; background: var(--bg2); }
        .welcome-step-num { width: 32px; height: 32px; border-radius: 50%; background: rgba(255,80,41,.15); color: var(--accent); font-family: var(--f-m, 'JetBrains Mono', monospace); font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .welcome-step-text h3 { font-family: var(--f-d, 'Syne', sans-serif); font-size: 15px; font-weight: 800; margin-bottom: 3px; color: var(--ink); }
        .welcome-step-text p { font-size: 13px; color: var(--ink-a60); }
        .welcome-cta { display: block; width: 100%; padding: 15px; background: var(--accent); color: #fff; border: none; border-radius: 10px; font-family: var(--f-d, 'Syne', sans-serif); font-size: 17px; font-weight: 800; cursor: pointer; transition: opacity 150ms; margin-bottom: 14px; text-decoration: none; }
        .welcome-cta:hover { opacity: .9; }
        .welcome-skip { font-size: 13px; color: var(--ink-a55); cursor: pointer; text-decoration: underline; }
        .welcome-skip:hover { color: var(--ink-a70); }
      `}</style>
    </div>
  );
}
