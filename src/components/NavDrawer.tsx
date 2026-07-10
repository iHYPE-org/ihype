'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AccessibilityControls } from '@/components/AccessibilityControls';

export const menuLinks = [
  { href: '/community', label: 'Community' },
  { href: '/advertise', label: 'Advertise' },
  { href: '/about', label: 'About' },
  { href: '/transparency', label: 'Transparency' },
  { href: '/legal', label: 'Legal' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/dmca', label: 'DMCA' },
];

/**
 * Self-manages its open state (and renders its own ☰ trigger) by default,
 * for the desktop header. Pass `open`/`onOpenChange` to control it
 * externally instead — MobileBottomNav does this so its own "Menu" tab can
 * open the same drawer without a second, redundant trigger button.
 */
export function NavDrawer({
  open: openProp,
  onOpenChange,
  showTrigger = true,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
} = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const pathname = usePathname();
  const { data: session } = useSession();
  const accountName = session?.user
    ? session.user.name || session.user.email?.split('@')[0] || 'Account'
    : null;

  return (
    <>
      {showTrigger && (
        <button
          className="nav-drawer-trigger"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          ☰
        </button>
      )}
      {open && (
        <>
          <div
            className="nav-drawer-backdrop"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <nav className="nav-drawer" aria-label="Secondary navigation">
            <button
              className="nav-drawer-close"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
              {accountName ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <Link
                    href="/me/settings"
                    onClick={() => setOpen(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', minWidth: 0 }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                        background: 'rgba(34,229,212,.18)', color: '#22e5d4',
                        fontFamily: "var(--font-display, 'Syne', sans-serif)", fontSize: 14, fontWeight: 800,
                      }}
                    >
                      {accountName.charAt(0).toUpperCase()}
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, minWidth: 0 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '.14em', textTransform: 'uppercase', color: '#22e5d4' }}>
                        Signed in
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {accountName}
                      </span>
                    </span>
                  </Link>
                  <a href="/api/auth/signout" style={{ fontSize: 12, opacity: 0.6, flexShrink: 0 }}>Sign out</a>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10 }}>
                  <Link className="button secondary small" href="/login" onClick={() => setOpen(false)} style={{ flex: 1, textAlign: 'center' }}>
                    Sign in
                  </Link>
                  <Link className="button small" href="/register" onClick={() => setOpen(false)} style={{ flex: 1, textAlign: 'center' }}>
                    Join free
                  </Link>
                </div>
              )}
            </div>
            <ul className="nav-drawer-list">
              {menuLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={`nav-drawer-link${isActive ? ' active' : ''}`}
                      onClick={() => setOpen(false)}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div style={{ borderTop: '1px solid var(--line)', padding: '12px 16px' }}>
              <AccessibilityControls />
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, opacity: 0.5 }}>Theme</span>
              <ThemeToggle />
            </div>
          </nav>
        </>
      )}
    </>
  );
}
