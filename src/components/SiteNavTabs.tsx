'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

const TABS = [
  {
    id: 'listen', label: 'Listen', href: '/listen', color: '#ff5029',
    icon: (
      <svg fill="none" height="17" viewBox="0 0 24 24" width="17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
        <path d="M2 16.5a2 2 0 0 1 2-2h1a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a2 2 0 0 1-2-2v-2Zm18 0a2 2 0 0 0-2-2h-1a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1a2 2 0 0 0 2-2v-2Z" />
      </svg>
    ),
  },
  {
    id: 'events', label: 'Events', href: '/shows', color: '#22e5d4',
    icon: (
      <svg fill="none" height="17" viewBox="0 0 24 24" width="17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        <rect height="16" rx="3" width="18" x="3" y="5" />
        <path d="M3 10h18M8 3v4M16 3v4" />
        <circle cx="12" cy="15" r="2" />
      </svg>
    ),
  },
  {
    id: 'pages', label: 'Pages', href: '/pages', color: '#b983ff',
    icon: (
      <svg fill="none" height="17" viewBox="0 0 24 24" width="17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
];

function matchTab(pathname: string): string {
  if (pathname.startsWith('/listen') || pathname.startsWith('/discover') || pathname.startsWith('/radio') || pathname === '/') return 'listen';
  if (pathname.startsWith('/shows') || pathname.startsWith('/events')) return 'events';
  if (pathname.startsWith('/pages') || pathname.startsWith('/artists') || pathname.startsWith('/venues') || pathname.startsWith('/fans')) return 'pages';
  return '';
}

export function SiteNavTabs() {
  const pathname = usePathname();
  const active = matchTab(pathname);
  const { data: session, status } = useSession();

  // Listen/Events/Pages are the signed-in app shell's own destinations — a
  // logged-out desktop visitor sees the marketing site (Sign in / Join free,
  // rendered by HeaderAuthLinks) in their place instead.
  if (status === 'loading' || !session?.user) return null;

  return (
    <nav aria-label="Main navigation tabs" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, height: '100%' }}>
      {TABS.map(t => {
        const isActive = active === t.id;
        return (
          <Link
            key={t.id}
            href={t.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 16px 8px 8px',
              borderRadius: 999,
              border: `1px solid ${t.color}${isActive ? '59' : '28'}`,
              background: `${t.color}${isActive ? '18' : '08'}`,
              textDecoration: 'none',
              transition: 'background 150ms cubic-bezier(0.2,0.7,0.3,1), border-color 150ms cubic-bezier(0.2,0.7,0.3,1)',
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 34,
                height: 34,
                borderRadius: 12,
                flexShrink: 0,
                background: `${t.color}${isActive ? '2e' : '16'}`,
                color: t.color,
              }}
            >
              {t.icon}
            </span>
            <span
              style={{
                fontFamily: "var(--font-display, 'Syne', sans-serif)",
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: '-0.01em',
                color: isActive ? 'var(--ink, #f0ebe5)' : 'rgba(240,235,229,0.75)',
              }}
            >
              {t.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
