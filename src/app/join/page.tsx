import Link from 'next/link';
import type { Metadata } from 'next';
import { isInviteCodeRequiredRuntime } from '@/lib/runtime-flags';
import { getServerT } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Join iHYPE',
  description: 'Join iHYPE as a Fan, Artist, Venue, or music-only Advertiser.',
};

// DJ removed 2026-08-05 (docs/dj-role-removal-scope.md). Radio is computed
// per listener now (src/lib/stations.ts), so there is nothing for a DJ to do
// that a fan account does not already do.
// Geometric glyphs, not emoji — Design System 8's first hard rule, and these
// four were the last emoji on a role surface. They are four distinct primitives
// from the vocabulary already in use across the app (the venue diamond is the
// same glyph the map draws its venue pins with), and each is tinted by its role
// token through --jc-color, so shape and colour both separate them.
const ROLES = [
  { label: 'Fan', color: 'var(--role-fan-text)', icon: '\u25CF', href: '/for-fans', help: 'Discover, hype, and buy tickets fee-free.' },
  { label: 'Artist', color: 'var(--accent-text)', icon: '\u25B2', href: '/for-artists', help: '70% of every ticket, your own page and shows.' },
  { label: 'Venue', color: 'var(--role-venue-text)', icon: '\u25C6', href: '/for-venues', help: '20% of every gate and real demand data.' },
  { label: 'Advertiser', color: 'var(--role-advertiser-text)', icon: '\u25A0', href: '/advertise/register', help: 'Music-only campaigns with no access to personal user data.' },
];

export default async function JoinChooserPage() {
  const inviteOnly = await isInviteCodeRequiredRuntime();
  const t = await getServerT();
  return (
    <div className="join-wrap">
      <div className="join-eyebrow">{inviteOnly ? t('joinPage.requestBeta', 'Request Beta') : t('joinPage.joinIhype', 'Join iHYPE')}</div>
      <h1 className="join-h1">{t('joinPage.heading', 'Choose how you join the scene.')}</h1>
      <p className="join-sub">
        {t('joinPage.subheading', "Fans, Artists, and Venues build the scene. Music-only Advertisers use a private campaign account. Pick the role that fits you.")}
      </p>
      <div className="join-grid">
        {ROLES.map((r, i) => (
          <Link className="join-card" href={r.href} key={r.label} style={{ ['--jc-color' as string]: r.color }}>
            <span aria-hidden="true" className="join-card-icon">{r.icon}</span>
            <span className="join-card-label">{t(`joinPage.roleLabel${i}`, r.label)}</span>
            <span className="join-card-help">{t(`joinPage.roleHelp${i}`, r.help)}</span>
          </Link>
        ))}
      </div>
      <Link className="join-skip" href="/register">{t('joinPage.skipCta', 'Just sign up as a fan →')}</Link>

      <style>{`
        .join-wrap { max-width: 720px; margin: 0 auto; padding: 80px 24px 100px; text-align: center; }
        .join-eyebrow { font-family: var(--font-mono); font-size: 0.6875rem; letter-spacing: .16em; text-transform: uppercase; color: var(--accent-text); margin-bottom: 10px; }
        .join-h1 { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.8rem, 5vw, 2.6rem); letter-spacing: -.03em; margin: 0 0 12px; color: var(--ink); }
        .join-sub { font-size: 0.9375rem; color: var(--ink-a65); line-height: 1.6; max-width: 52ch; margin: 0 auto 40px; }
        .join-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-bottom: 28px; }
        .join-card { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; text-align: left; padding: 22px 20px; border-radius: 16px; border: 1px solid var(--line); border-top: 3px solid var(--jc-color); background: var(--bg2); text-decoration: none; }
        /* A glyph takes its colour from CSS where an emoji ignored it — so the
           role token that already tints the label now tints the mark too. */
        .join-card-icon { font-size: 1.6rem; color: var(--jc-color); line-height: 1; }
        .join-card-label { font-family: var(--font-display); font-weight: 800; font-size: 1rem; color: var(--jc-color); }
        .join-card-help { font-size: 0.7813rem; color: var(--ink-a65); line-height: 1.5; }
        .join-skip { font-family: var(--font-mono); font-size: 0.7813rem; color: var(--ink-a65); text-decoration: underline; }
        @media (max-width: 560px) { .join-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
