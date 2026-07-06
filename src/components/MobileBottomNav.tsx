'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NavDrawer } from '@/components/NavDrawer';
import { useMobileShell } from '@/lib/MobileShellContext';
import type { ShellSection } from '@/lib/mobileShell';

const TAB_TO_SECTION: Record<string, ShellSection> = { listen: 'listen', events: 'shows', pages: 'pages' };

const TABS = [
  {
    id: 'listen',
    label: 'Listen',
    href: '/listen',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13"/>
        <circle cx="6" cy="18" r="3"/>
        <circle cx="18" cy="16" r="3"/>
      </svg>
    ),
  },
  {
    id: 'events',
    label: 'Events',
    href: '/shows',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    id: 'pages',
    label: 'Pages',
    href: '/pages',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    ),
  },
];

function matchTab(pathname: string): string {
  if (pathname.startsWith('/listen') || pathname.startsWith('/discover') || pathname.startsWith('/radio')) return 'listen';
  if (pathname.startsWith('/shows') || pathname.startsWith('/events')) return 'events';
  if (pathname.startsWith('/pages') || pathname.startsWith('/artists') || pathname.startsWith('/venues') || pathname.startsWith('/fans')) return 'pages';
  return '';
}

// Auth-flow pages, plus /auth/magic and /auth/landing (both under /auth).
const AUTH_PATHS = ['/login', '/register', '/welcome', '/verify', '/beta', '/auth'];

const tabButtonStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  gap: 3,
  flex: 1,
  textDecoration: 'none',
  fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
  fontSize: '0.65rem',
  fontWeight: 500,
  letterSpacing: '0.02em',
  transition: 'color 0.15s',
  WebkitTapHighlightColor: 'transparent',
};

export function MobileBottomNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const shell = useMobileShell();

  // Index (the marketing/pitch page) and every auth-flow page: no app chrome
  // before someone's actually signed up.
  if (pathname === '/' || AUTH_PATHS.some(p => pathname.startsWith(p))) return null;

  // While the shell is active, its own section state is the source of truth
  // for which tab is "active" — window.history.pushState (used to update the
  // URL without a real navigation) doesn't necessarily update usePathname().
  const active = shell?.active
    ? (shell.section === 'shows' ? 'events' : shell.section)
    : matchTab(pathname);

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="ihype-mobile-nav"
        style={{
          display: 'none',
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          height: 60,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          background: 'rgba(13,13,13,0.96)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          zIndex: 900,
          alignItems: 'stretch',
          justifyContent: 'space-around',
        }}
      >
        {TABS.map(t => (
          <Link
            key={t.id}
            href={t.href}
            onClick={(e) => {
              if (!shell?.active) return;
              e.preventDefault();
              shell.setSection(TAB_TO_SECTION[t.id]);
            }}
            style={{ ...tabButtonStyle, color: active === t.id ? 'var(--accent, #ff5029)' : 'rgba(240,240,240,0.45)' }}
          >
            {t.icon}
            <span>{t.label}</span>
          </Link>
        ))}
        <button
          aria-expanded={menuOpen}
          aria-label="Open menu"
          onClick={() => setMenuOpen(true)}
          style={{ ...tabButtonStyle, background: 'none', border: 'none', cursor: 'pointer', color: menuOpen ? 'var(--accent, #ff5029)' : 'rgba(240,240,240,0.45)' }}
          type="button"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>
          <span>Menu</span>
        </button>
      </nav>
      <NavDrawer onOpenChange={setMenuOpen} open={menuOpen} showTrigger={false} />
    </>
  );
}
