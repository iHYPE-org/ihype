import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import Link from 'next/link';
import type { Metadata } from 'next';
import { WelcomeStepsChecklist } from '@/components/WelcomeStepsChecklist';
import { getServerT } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Welcome · iHYPE',
  robots: { index: false, follow: false },
};

type Role = 'FAN' | 'ARTIST' | 'VENUE' | 'DJ';

export default async function WelcomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/register');

  const t = await getServerT();

  const CONFIG: Record<Role, {
    name: string; roleLabel: string; tint: string; pendingNote: string;
    sub: string; cta: string; ctaHref: string;
    steps: { title: string; desc: string }[];
  }> = {
    FAN: {
      name: 'Jess R.', roleLabel: t('welcomePage.roleFan', 'Fan'), tint: '#b983ff', pendingNote: t('welcomePage.pendingActiveNow', ' · Active now'),
      sub: t('welcomePage.subFan', 'Your account is live. Start hyping the artists you believe in — your listens and hypes shape who gets discovered.'),
      cta: t('welcomePage.ctaFan', 'Start listening →'), ctaHref: '/listen',
      steps: [
        { title: t('welcomePage.fanStep1Title', 'Hype your first artist'), desc: t('welcomePage.fanStep1Desc', 'Listen to a track all the way through or tap the flame — every hype is a demand signal venues can see.') },
        { title: t('welcomePage.fanStep2Title', 'Follow your scene'), desc: t('welcomePage.fanStep2Desc', 'Pick your city and genres so Local shows and For You surface the right nights out.') },
        { title: t('welcomePage.fanStep3Title', 'Share a referral link'), desc: t('welcomePage.fanStep3Desc', 'Promote any show you love and earn from the dedicated 10% promoter pool.') },
      ],
    },
    ARTIST: {
      name: 'Nyla', roleLabel: t('welcomePage.roleArtist', 'Artist'), tint: '#ff5029', pendingNote: t('welcomePage.pendingVerification', ' · Verification pending (~48h)'),
      sub: t('welcomePage.subArtist', 'Welcome to the platform where 70% of every ticket is yours — locked by charter, before a single ticket sells.'),
      cta: t('welcomePage.ctaArtist', 'Set up your page →'), ctaHref: '/pages',
      steps: [
        { title: t('welcomePage.artistStep1Title', 'Complete verification'), desc: t('welcomePage.artistStep1Desc', 'Link your catalog and confirm identity — the 70% split activates the moment you’re verified.') },
        { title: t('welcomePage.artistStep2Title', 'Upload your first track'), desc: t('welcomePage.artistStep2Desc', 'Choose all-rights or free-use licensing per track; free-use tracks can be crated by DJs for radio shows.') },
        { title: t('welcomePage.artistStep3Title', 'Publish a show'), desc: t('welcomePage.artistStep3Desc', 'Set face-value pricing and lock your 70/20 charter. Fans buy direct — $0 platform fees.') },
      ],
    },
    VENUE: {
      name: 'Port City Music Hall', roleLabel: t('welcomePage.roleVenue', 'Venue'), tint: '#22e5d4', pendingNote: t('welcomePage.pendingVerification', ' · Verification pending (~48h)'),
      sub: t('welcomePage.subVenue', 'A guaranteed 20% of every gate, by charter — plus real demand data on who fans actually want to see.'),
      cta: t('welcomePage.ctaVenue', 'List your room →'), ctaHref: '/pages',
      steps: [
        { title: t('welcomePage.venueStep1Title', 'Verify your room'), desc: t('welcomePage.venueStep1Desc', 'Confirm capacity and address so events can go live with serialized, QR-verified tickets.') },
        { title: t('welcomePage.venueStep2Title', 'Check the demand radar'), desc: t('welcomePage.venueStep2Desc', 'See which artists your city is hyping before you book — no promoter guesswork.') },
        { title: t('welcomePage.venueStep3Title', 'Publish your first event'), desc: t('welcomePage.venueStep3Desc', 'Your 20% is locked in the charter at publish. Settlement goes direct after the show.') },
      ],
    },
    DJ: {
      name: 'DJ Caro', roleLabel: t('welcomePage.roleDj', 'DJ'), tint: '#ff3e9a', pendingNote: t('welcomePage.pendingVerification', ' · Verification pending (~48h)'),
      sub: t('welcomePage.subDj', 'Your studio is waiting. Build radio shows from the free-use library and get paid to promote the shows you play.'),
      cta: t('welcomePage.ctaDj', 'Open the studio →'), ctaHref: '/radio',
      steps: [
        { title: t('welcomePage.djStep1Title', 'Crate some tracks'), desc: t('welcomePage.djStep1Desc', 'Browse the free-use library and add tracks to your crate — they’re licensed for your radio shows.') },
        { title: t('welcomePage.djStep2Title', 'Record your first show'), desc: t('welcomePage.djStep2Desc', 'Mix crated tracks with your voice and royalty-free SFX, right from your phone.') },
        { title: t('welcomePage.djStep3Title', 'Promote and earn'), desc: t('welcomePage.djStep3Desc', 'Share referral links for shows you play — you earn from the 10% promoter pool.') },
      ],
    },
  };

  const sessionRole = (session.user as { role?: string }).role;
  const role: Role = sessionRole === 'ARTIST' || sessionRole === 'VENUE' || sessionRole === 'DJ' ? sessionRole : 'FAN';
  const c = CONFIG[role];
  const initial = c.name.charAt(0);

  return (
    <div className="welcome-body">
      <div className="welcome-card">
        <div className="welcome-check">✓</div>
        <h1 className="welcome-h1">{t('welcomePage.heading', "You're in.")}</h1>
        <p className="welcome-sub">{c.sub}</p>

        <div className="welcome-panel">
          <div className="welcome-identity">
            <div className="welcome-avatar" style={{ background: `linear-gradient(135deg, ${c.tint}, #b983ff)` }}>{initial}</div>
            <div>
              <div className="welcome-name">{c.name}</div>
              <div className="welcome-role" style={{ color: c.tint }}>{c.roleLabel}{c.pendingNote}</div>
            </div>
          </div>
          <WelcomeStepsChecklist steps={c.steps} tint={c.tint} />
        </div>

        <Link className="welcome-cta" href={c.ctaHref}>{c.cta}</Link>
        <div className="welcome-split">{t('welcomePage.splitFooter', '70% artist · 20% venue · 10% promoters · 0% iHYPE')}</div>
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
        .welcome-steps-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .welcome-steps-label { font-family: var(--f-m, 'JetBrains Mono', monospace); font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: var(--ink-a55); }
        .welcome-ring { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .welcome-ring span { width: 24px; height: 24px; border-radius: 50%; background: var(--bg); display: flex; align-items: center; justify-content: center; font-family: var(--f-m, 'JetBrains Mono', monospace); font-size: 8.5px; color: var(--ink-a70); }
        .welcome-steps { display: flex; flex-direction: column; }
        .welcome-step { display: flex; gap: 14px; align-items: flex-start; padding: 11px 0; width: 100%; background: none; border: none; cursor: pointer; text-align: left; font: inherit; }
        .welcome-step-num { flex-shrink: 0; width: 24px; height: 24px; border-radius: 7px; background: rgba(255,80,41,.12); color: var(--accent); font-family: var(--f-d, 'Syne', sans-serif); font-weight: 800; font-size: 12px; display: flex; align-items: center; justify-content: center; }
        .welcome-step.done .welcome-step-num { background: rgba(34,229,212,.15); color: var(--role-venue, #22e5d4); }
        .welcome-step-title { font-weight: 700; font-size: 14px; color: var(--ink); }
        .welcome-step.done .welcome-step-title { color: var(--ink-a70); text-decoration: line-through; }
        .welcome-step-desc { font-size: 13px; color: var(--ink-a70); line-height: 1.55; margin-top: 2px; }
        .welcome-cta { display: inline-block; margin-top: 28px; font-family: var(--f-d, 'Syne', sans-serif); font-weight: 800; font-size: 15px; background: var(--accent); color: #fff; padding: 14px 34px; border-radius: 999px; box-shadow: 0 6px 24px rgba(255,80,41,.35); text-decoration: none; transition: opacity 150ms; }
        .welcome-cta:hover { opacity: .9; }
        .welcome-split { font-family: var(--f-m, 'JetBrains Mono', monospace); font-size: 10px; color: var(--ink-a55); margin-top: 16px; letter-spacing: .06em; }
      `}</style>
    </div>
  );
}
