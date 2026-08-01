import Link from 'next/link';
import type { Metadata } from 'next';
import { isInviteCodeRequiredRuntime } from '@/lib/runtime-flags';
import { getServerT } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Join iHYPE',
  description: 'Join iHYPE as a Fan, Artist, DJ, Venue, or music-only Advertiser.',
};

const ROLES = [
  { label: 'Fan', color: 'var(--role-fan)', icon: '🎧', href: '/for-fans', help: 'Discover, hype, and buy tickets fee-free.' },
  { label: 'Artist', color: 'var(--accent)', icon: '🎤', href: '/for-artists', help: '70% of every ticket, your own page and shows.' },
  { label: 'DJ', color: 'var(--role-dj, var(--accent-2))', icon: '🎛️', href: '/for-djs', help: 'A free radio studio and HYPE Link promotion.' },
  { label: 'Venue', color: 'var(--role-venue)', icon: '🏛️', href: '/for-venues', help: '20% of every gate and real demand data.' },
  { label: 'Advertiser', color: 'var(--role-advertiser, var(--role-promoter))', icon: '📻', href: '/advertise/register', help: 'Music-only campaigns with no access to personal user data.' },
];

export default async function JoinChooserPage() {
  const inviteOnly = await isInviteCodeRequiredRuntime();
  const t = await getServerT();
  return (
    <div className="join-wrap">
      <div className="join-eyebrow">{inviteOnly ? t('joinPage.requestBeta', 'Request Beta') : t('joinPage.joinIhype', 'Join iHYPE')}</div>
      <h1 className="join-h1">{t('joinPage.heading', 'Choose how you join the scene.')}</h1>
      <p className="join-sub">
        {t('joinPage.subheading', "Fans, Artists, DJs, and Venues build the scene. Music-only Advertisers use a private campaign account. Pick the role that fits you.")}
      </p>
      <div className="join-grid">
        {ROLES.map((r, i) => (
          <Link className="join-card" href={r.href} key={r.label} style={{ ['--jc-color' as string]: r.color }}>
            <span className="join-card-icon">{r.icon}</span>
            <span className="join-card-label">{t(`joinPage.roleLabel${i}`, r.label)}</span>
            <span className="join-card-help">{t(`joinPage.roleHelp${i}`, r.help)}</span>
          </Link>
        ))}
      </div>
      <Link className="join-skip" href="/register">{t('joinPage.skipCta', 'Just sign up as a fan →')}</Link>

      <style>{`
        .join-wrap { max-width: 720px; margin: 0 auto; padding: 80px 24px 100px; text-align: center; }
        .join-eyebrow { font-family: var(--font-mono); font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: var(--accent); margin-bottom: 10px; }
        .join-h1 { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.8rem, 5vw, 2.6rem); letter-spacing: -.03em; margin: 0 0 12px; color: var(--ink); }
        .join-sub { font-size: 15px; color: var(--ink-a65); line-height: 1.6; max-width: 52ch; margin: 0 auto 40px; }
        .join-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-bottom: 28px; }
        .join-card { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; text-align: left; padding: 22px 20px; border-radius: 16px; border: 1px solid var(--line); border-top: 3px solid var(--jc-color); background: var(--bg2); text-decoration: none; }
        .join-card-icon { font-size: 1.6rem; }
        .join-card-label { font-family: var(--font-display); font-weight: 800; font-size: 16px; color: var(--jc-color); }
        .join-card-help { font-size: 12.5px; color: var(--ink-a60); line-height: 1.5; }
        .join-skip { font-family: var(--font-mono); font-size: 12px; color: var(--ink-a55); text-decoration: underline; }
        @media (max-width: 560px) { .join-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
