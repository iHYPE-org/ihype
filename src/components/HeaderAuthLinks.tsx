'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useI18n } from '@/components/I18nProvider';

/**
 * Right side of the site header. Signed out: Sign in / Join Beta. Signed in:
 * a compact account chip (avatar initial + name) so it's always visible that
 * you're logged in — links to Settings.
 *
 * `inviteOnly` comes from isInviteCodeRequiredRuntime() in the root layout.
 * The join CTA reads "Join Beta" only while signup is actually invite-gated
 * and falls back to "Join free" the moment that flag flips — the same
 * self-correction the homepage's own primary CTA uses (src/app/page.tsx),
 * and the reason the row 235-era fix removed hardcoded "beta" copy
 * elsewhere. Calling the platform a beta after it opens is a stale promise.
 */
export function HeaderAuthLinks({ inviteOnly = false }: { inviteOnly?: boolean }) {
  const { data: session, status } = useSession();
  const { t } = useI18n();

  if (status === 'loading') return null;

  if (session?.user) {
    const display = session.user.name || session.user.email?.split('@')[0] || t('headerAuthLinks.account', 'Account');
    const initial = display.charAt(0).toUpperCase();
    return (
      <Link
        aria-label={`${t('headerAuthLinks.signedInAs', 'Signed in as')} ${display} — ${t('headerAuthLinks.openSettings', 'open settings')}`}
        href="/me/settings"
        title={`${t('headerAuthLinks.signedInAs', 'Signed in as')} ${display}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 12px 5px 5px',
          borderRadius: 999,
          border: '1px solid rgba(var(--role-venue-rgb),.32)',
          background: 'rgba(var(--role-venue-rgb),.08)',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          maxWidth: 180,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            borderRadius: '50%',
            flexShrink: 0,
            background: session.user.image ? `url(${session.user.image}) center/cover` : 'rgba(var(--role-venue-rgb),.18)',
            color: 'var(--role-venue)',
            fontFamily: "var(--font-display)",
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          {session.user.image ? '' : initial}
        </span>
        <span
          style={{
            display: 'flex',
            flexDirection: 'column',
            lineHeight: 1.15,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontSize: 8,
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: 'var(--role-venue)',
            }}
          >
            {t('headerAuthLinks.signedIn', 'Signed in')}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--ink)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {display}
          </span>
        </span>
      </Link>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Link href="/login" className="button secondary small nav-auth-button">
        {t('headerAuthLinks.signIn', 'Sign in')}
      </Link>
      <Link href="/register" className="button small nav-join-button">
        {inviteOnly
          ? t('headerAuthLinks.joinBeta', 'Join Beta')
          : t('headerAuthLinks.joinFree', 'Join free')}
      </Link>
    </div>
  );
}
