'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';

/**
 * Right side of the site header. Signed out: Sign in / Join free. Signed in:
 * a compact account chip (avatar initial + name) so it's always visible that
 * you're logged in — links to Settings.
 */
export function HeaderAuthLinks() {
  const { data: session, status } = useSession();

  if (status === 'loading') return null;

  if (session?.user) {
    const display = session.user.name || session.user.email?.split('@')[0] || 'Account';
    const initial = display.charAt(0).toUpperCase();
    return (
      <Link
        aria-label={`Signed in as ${display} — open settings`}
        href="/me/settings"
        title={`Signed in as ${display}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 12px 5px 5px',
          borderRadius: 999,
          border: '1px solid rgba(34,229,212,.32)',
          background: 'rgba(34,229,212,.08)',
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
            background: session.user.image ? `url(${session.user.image}) center/cover` : 'rgba(34,229,212,.18)',
            color: '#22e5d4',
            fontFamily: "var(--font-display, 'Syne', sans-serif)",
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
              color: '#22e5d4',
            }}
          >
            Signed in
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
        Sign in
      </Link>
      <Link href="/register" className="button small nav-join-button">
        Join free
      </Link>
    </div>
  );
}
