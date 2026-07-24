import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getProfileType } from '@/lib/profile-creation';
import { FanTasteCapture } from '@/components/FanTasteCapture';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Welcome · iHYPE',
  robots: { index: false, follow: false },
};

type Role = 'FAN' | 'ARTIST' | 'VENUE' | 'DJ';

const CONFIG: Record<Role, {
  roleLabel: string; tint: string;
  sub: string; cta: string; ctaHref: string;
  steps: { title: string; desc: string }[];
}> = {
  FAN: {
    roleLabel: 'Fan', tint: '#b983ff',
    sub: 'Your account is live. Start hyping the artists you believe in — your listens and hypes shape who gets discovered.',
    cta: 'Start listening →', ctaHref: '/listen',
    steps: [
      { title: 'Hype your first artist', desc: 'Listen to a track all the way through or tap the flame — every hype is a demand signal venues can see.' },
      { title: 'Follow your scene', desc: 'Pick your city and genres so Local shows and For You surface the right nights out.' },
      { title: 'Share a referral link', desc: 'Promote any show you love and earn from the dedicated 10% promoter pool.' },
    ],
  },
  ARTIST: {
    roleLabel: 'Artist', tint: '#ff5029',
    sub: 'Welcome to the platform where 70% of every ticket is yours — locked by charter, before a single ticket sells.',
    cta: 'Set up your page →', ctaHref: '/pages',
    steps: [
      { title: 'Complete verification', desc: 'Link your catalog and confirm identity — the 70% split activates the moment you’re verified.' },
      { title: 'Upload your first track', desc: 'Choose all-rights or free-use licensing per track; free-use tracks can be crated by DJs for radio shows.' },
      { title: 'Publish a show', desc: 'Set face-value pricing and lock your 70/20 charter. Fans buy direct — $0 platform fees.' },
    ],
  },
  VENUE: {
    roleLabel: 'Venue', tint: '#22e5d4',
    sub: 'A guaranteed 20% of every gate, by charter — plus real demand data on who fans actually want to see.',
    cta: 'List your room →', ctaHref: '/pages',
    steps: [
      { title: 'Verify your room', desc: 'Confirm capacity and address so events can go live with serialized, QR-verified tickets.' },
      { title: 'Check the demand radar', desc: 'See which artists your city is hyping before you book — no promoter guesswork.' },
      { title: 'Publish your first event', desc: 'Your 20% is locked in the charter at publish. Settlement goes direct after the show.' },
    ],
  },
  DJ: {
    roleLabel: 'DJ', tint: '#ff3e9a',
    sub: 'Your studio is waiting. Build radio shows from the free-use library and get paid to promote the shows you play.',
    cta: 'Open the studio →', ctaHref: '/radio',
    steps: [
      { title: 'Crate some tracks', desc: 'Browse the free-use library and add tracks to your crate — they’re licensed for your radio shows.' },
      { title: 'Record your first show', desc: 'Mix crated tracks with your voice and royalty-free SFX, right from your phone.' },
      { title: 'Promote and earn', desc: 'Share referral links for shows you play — you earn from the 10% promoter pool.' },
    ],
  },
};

function verificationNote(status: string | undefined) {
  if (status === 'VERIFIED') return ' · Verified';
  if (status === 'PENDING') return ' · Verification pending (~48h)';
  return ' · Verification needed';
}

export default async function WelcomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/register');

  const sessionRole = (session.user as { role?: string }).role;
  const role: Role = sessionRole === 'ARTIST' || sessionRole === 'VENUE' || sessionRole === 'DJ' ? sessionRole : 'FAN';
  const c = CONFIG[role];

  // Real signed-in identity — this used to be a hardcoded example name
  // ("Jess R." / "Nyla" / "DJ Caro" / "Port City Music Hall") shown to
  // every single user regardless of who actually signed up.
  const [dbUser, ownProfile] = await Promise.all([
    db.user.findUnique({ where: { id: session.user.id }, select: { name: true, username: true } }),
    db.profile.findFirst({
      where: { ownerId: session.user.id, type: getProfileType(role) },
      select: { id: true, name: true, city: true, genres: true, verificationStatus: true },
    }),
  ]);

  const displayName = role === 'FAN'
    ? (dbUser?.name || dbUser?.username || 'there')
    : (ownProfile?.name || dbUser?.name || 'there');
  const initial = displayName.charAt(0).toUpperCase();
  const pendingNote = role === 'FAN' ? ' · Active now' : verificationNote(ownProfile?.verificationStatus);

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
              <div className="welcome-name">{displayName}</div>
              <div className="welcome-role" style={{ color: c.tint }}>{c.roleLabel}{pendingNote}</div>
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
                  {role === 'FAN' && i === 1 && ownProfile && (
                    <FanTasteCapture
                      profileId={ownProfile.id}
                      initialCity={ownProfile.city ?? ''}
                      initialGenres={ownProfile.genres ?? []}
                    />
                  )}
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
