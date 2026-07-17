import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Welcome · iHYPE',
  robots: { index: false, follow: false },
};

type Role = 'FAN' | 'ARTIST' | 'VENUE' | 'DJ';

const CONFIG: Record<Role, {
  name: string; roleLabel: string; tint: string; pendingNote: string;
  sub: string; cta: string; ctaHref: string;
  steps: { title: string; desc: string }[];
}> = {
  FAN: {
    name: 'Jess R.', roleLabel: 'Fan', tint: '#b983ff', pendingNote: ' · Active now',
    sub: 'Your account is live. Start hyping the artists you believe in — your listens and hypes shape who gets discovered.',
    cta: 'Start listening →', ctaHref: '/listen',
    steps: [
      { title: 'Hype your first artist', desc: 'Listen to a track all the way through or tap the flame — every hype is a demand signal venues can see.' },
      { title: 'Follow your scene', desc: 'Pick your city and genres so Local shows and For You surface the right nights out.' },
      { title: 'Share a referral link', desc: 'Promote any show you love and earn from the dedicated 10% promoter pool.' },
    ],
  },
  ARTIST: {
    name: 'Nyla', roleLabel: 'Artist', tint: '#ff5029', pendingNote: ' · Verification pending (~48h)',
    sub: 'Welcome to the platform where 70% of every ticket is yours — locked by charter, before a single ticket sells.',
    cta: 'Set up your page →', ctaHref: '/pages',
    steps: [
      { title: 'Complete verification', desc: 'Link your catalog and confirm identity — the 70% split activates the moment you’re verified.' },
      { title: 'Upload your first track', desc: 'Choose all-rights or free-use licensing per track; free-use tracks can be crated by DJs for radio shows.' },
      { title: 'Publish a show', desc: 'Set face-value pricing and lock your 70/20 charter. Fans buy direct — $0 platform fees.' },
    ],
  },
  VENUE: {
    name: 'Port City Music Hall', roleLabel: 'Venue', tint: '#22e5d4', pendingNote: ' · Verification pending (~48h)',
    sub: 'A guaranteed 20% of every gate, by charter — plus real demand data on who fans actually want to see.',
    cta: 'List your room →', ctaHref: '/pages',
    steps: [
      { title: 'Verify your room', desc: 'Confirm capacity and address so events can go live with serialized, QR-verified tickets.' },
      { title: 'Check the demand radar', desc: 'See which artists your city is hyping before you book — no promoter guesswork.' },
      { title: 'Publish your first event', desc: 'Your 20% is locked in the charter at publish. Settlement goes direct after the show.' },
    ],
  },
  DJ: {
    name: 'DJ Caro', roleLabel: 'DJ', tint: '#ff3e9a', pendingNote: ' · Verification pending (~48h)',
    sub: 'Your studio is waiting. Build radio shows from the free-use library and get paid to promote the shows you play.',
    cta: 'Open the studio →', ctaHref: '/radio',
    steps: [
      { title: 'Crate some tracks', desc: 'Browse the free-use library and add tracks to your crate — they’re licensed for your radio shows.' },
      { title: 'Record your first show', desc: 'Mix crated tracks with your voice and royalty-free SFX, right from your phone.' },
      { title: 'Promote and earn', desc: 'Share referral links for shows you play — you earn from the 10% promoter pool.' },
    ],
  },
};

export default async function WelcomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/register');

  const sessionRole = (session.user as { role?: string }).role;
  const role: Role = sessionRole === 'ARTIST' || sessionRole === 'VENUE' || sessionRole === 'DJ' ? sessionRole : 'FAN';
  const c = CONFIG[role];
  const initial = c.name.charAt(0);

  return (
    <div className="welcome-body">
      <div className="welcome-card">
        <div className="welcome-check">✓</div>
        <h1 className="welcome-h1">You&apos;re in.</h1>
        <p className="welcome-sub">{c.sub}</p>

        <div className="welcome-panel">
          <div className="welcome-identity">
            <div className="welcome-avatar" style={{ background: `linear-gradient(135deg, ${c.tint}, #b983ff)` }}>{initial}</div>
            <div>
              <div className="welcome-name">{c.name}</div>
              <div className="welcome-role" style={{ color: c.tint }}>{c.roleLabel}{c.pendingNote}</div>
            </div>
          </div>
          <div className="welcome-steps-label">Next steps</div>
          <div className="welcome-steps">
            {c.steps.map((s, i) => (
              <div className="welcome-step" key={s.title}>
                <span className="welcome-step-num">{i + 1}</span>
                <div className="welcome-step-text">
                  <div className="welcome-step-title">{s.title}</div>
                  <div className="welcome-step-desc">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Link className="welcome-cta" href={c.ctaHref}>{c.cta}</Link>
        <div className="welcome-split">70% artist · 20% venue · 10% promoters · 0% iHYPE</div>
      </div>

      <style>{`
        .welcome-body { background: var(--bg); display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
        .welcome-card { max-width: 560px; width: 100%; text-align: center; }
        .welcome-check { width: 64px; height: 64px; border-radius: 50%; background: rgba(34,229,212,.12); border: 1px solid rgba(34,229,212,.35); display: flex; align-items: center; justify-content: center; margin: 0 auto 22px; font-size: 26px; color: #22e5d4; }
        .welcome-h1 { font-family: var(--f-d, 'Syne', sans-serif); font-weight: 800; font-size: clamp(32px, 7vw, 48px); letter-spacing: -.04em; line-height: 1; color: var(--ink); }
        .welcome-sub { font-size: 16px; color: var(--ink-a70); line-height: 1.65; margin: 14px 0 36px; }
        .welcome-panel { text-align: left; background: var(--bg2); border: 1px solid var(--line); border-radius: 18px; padding: 26px 26px 18px; }
        .welcome-identity { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 18px; border-bottom: 1px solid var(--line); }
        .welcome-avatar { width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #fff; font-family: var(--f-d, 'Syne', sans-serif); font-weight: 800; }
        .welcome-name { font-family: var(--f-d, 'Syne', sans-serif); font-weight: 800; font-size: 16px; color: var(--ink); }
        .welcome-role { font-family: var(--f-m, 'JetBrains Mono', monospace); font-size: 10px; letter-spacing: .12em; text-transform: uppercase; margin-top: 2px; }
        .welcome-steps-label { font-family: var(--f-m, 'JetBrains Mono', monospace); font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: var(--ink-a55); margin-bottom: 14px; }
        .welcome-steps { display: flex; flex-direction: column; }
        .welcome-step { display: flex; gap: 14px; align-items: flex-start; padding: 11px 0; }
        .welcome-step-num { flex-shrink: 0; width: 24px; height: 24px; border-radius: 7px; background: rgba(255,80,41,.12); color: var(--accent); font-family: var(--f-d, 'Syne', sans-serif); font-weight: 800; font-size: 12px; display: flex; align-items: center; justify-content: center; }
        .welcome-step-title { font-weight: 700; font-size: 14px; color: var(--ink); }
        .welcome-step-desc { font-size: 13px; color: var(--ink-a70); line-height: 1.55; margin-top: 2px; }
        .welcome-cta { display: inline-block; margin-top: 28px; font-family: var(--f-d, 'Syne', sans-serif); font-weight: 800; font-size: 15px; background: var(--accent); color: #fff; padding: 14px 34px; border-radius: 999px; box-shadow: 0 6px 24px rgba(255,80,41,.35); text-decoration: none; transition: opacity 150ms; }
        .welcome-cta:hover { opacity: .9; }
        .welcome-split { font-family: var(--f-m, 'JetBrains Mono', monospace); font-size: 10px; color: var(--ink-a55); margin-top: 16px; letter-spacing: .06em; }
      `}</style>
    </div>
  );
}
