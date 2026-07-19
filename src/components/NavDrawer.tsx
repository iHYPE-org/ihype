'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AccessibilityControls } from '@/components/AccessibilityControls';

const ico = {
  fill: 'none' as const,
  width: 17,
  height: 17,
  viewBox: '0 0 24 24',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const menuLinks = [
  {
    href: '/community', label: 'Community',
    icon: <svg {...ico}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M16.5 14.6c2.9.3 5 2.2 5 5.4" /></svg>,
  },
  {
    href: '/advertise', label: 'Advertise',
    icon: <svg {...ico}><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6l-5 4H4a1 1 0 0 0-1 1Z" /><path d="M15 9.5a4 4 0 0 1 0 5" /><path d="M17.5 7a8 8 0 0 1 0 10" /></svg>,
  },
  {
    href: '/about', label: 'About',
    icon: <svg {...ico}><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></svg>,
  },
  {
    href: '/transparency', label: 'Transparency',
    icon: <svg {...ico}><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></svg>,
  },
  {
    href: '/audit', label: 'Trust & Safety',
    icon: <svg {...ico}><path d="M12 3 4 6v6c0 4.4 3.4 8.2 8 9 4.6-.8 8-4.6 8-9V6Z" /><path d="m9 12 2 2 4-4" /></svg>,
  },
  {
    href: '/legal', label: 'Legal',
    icon: <svg {...ico}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h6" /></svg>,
  },
  {
    href: '/privacy', label: 'Privacy',
    icon: <svg {...ico}><rect height="10" rx="2" width="14" x="5" y="11" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>,
  },
  {
    href: '/dmca', label: 'DMCA',
    icon: <svg {...ico}><path d="M12 3 4 6v6c0 4.4 3.4 8.2 8 9 4.6-.8 8-4.6 8-9V6Z" /></svg>,
  },
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
              <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15" stroke="currentColor" strokeLinecap="round" strokeWidth="2">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
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
            {accountName && (
              <ul className="nav-drawer-list">
                <li>
                  <Link
                    href="/me/dashboard"
                    className={`nav-drawer-link${pathname === '/me/dashboard' ? ' active' : ''}`}
                    onClick={() => setOpen(false)}
                  >
                    <svg {...ico}><rect height="8" rx="1.5" width="8" x="3" y="3" /><rect height="4" rx="1.5" width="8" x="13" y="3" /><rect height="4" rx="1.5" width="8" x="13" y="11" /><rect height="8" rx="1.5" width="8" x="3" y="13" /></svg>
                    My Dashboard
                  </Link>
                </li>
                <li>
                  <Link
                    href="/me/notifications"
                    className={`nav-drawer-link${pathname === '/me/notifications' ? ' active' : ''}`}
                    onClick={() => setOpen(false)}
                  >
                    <svg {...ico}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                    Notifications
                  </Link>
                </li>
                <li>
                  <Link
                    href="/me/wrapped"
                    className={`nav-drawer-link${pathname === '/me/wrapped' ? ' active' : ''}`}
                    onClick={() => setOpen(false)}
                  >
                    <svg {...ico}><path d="M12 3l2.5 5.7 6 .5-4.5 4 1.4 6-5.4-3.2L6.6 19l1.4-6-4.5-4 6-.5L12 3Z" /></svg>
                    My Scene
                  </Link>
                </li>
              </ul>
            )}
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
                      {link.icon}
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
