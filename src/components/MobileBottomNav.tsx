'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  {
    id: 'listen',
    label: 'Listen',
    href: '/home',
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
  if (pathname.startsWith('/home') || pathname.startsWith('/discover') || pathname.startsWith('/radio') || pathname === '/') return 'listen';
  if (pathname.startsWith('/shows') || pathname.startsWith('/events')) return 'events';
  if (pathname.startsWith('/pages') || pathname.startsWith('/artists') || pathname.startsWith('/venues') || pathname.startsWith('/fans')) return 'pages';
  return '';
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const active = matchTab(pathname);

  return (
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
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            flex: 1,
            color: active === t.id ? 'var(--accent, #ff5029)' : 'rgba(240,240,240,0.45)',
            textDecoration: 'none',
            fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
            fontSize: '0.65rem',
            fontWeight: 500,
            letterSpacing: '0.02em',
            transition: 'color 0.15s',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {t.icon}
          <span>{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}
