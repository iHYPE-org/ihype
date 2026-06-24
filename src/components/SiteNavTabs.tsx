'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { id: 'listen', label: 'Listen', href: '/home' },
  { id: 'events', label: 'Events', href: '/shows' },
  { id: 'pages',  label: 'Pages',  href: '/pages' },
];

function matchTab(pathname: string): string {
  if (pathname.startsWith('/home') || pathname.startsWith('/discover') || pathname.startsWith('/radio') || pathname === '/') return 'listen';
  if (pathname.startsWith('/shows') || pathname.startsWith('/events')) return 'events';
  if (pathname.startsWith('/pages') || pathname.startsWith('/artists') || pathname.startsWith('/venues') || pathname.startsWith('/fans')) return 'pages';
  return '';
}

export function SiteNavTabs() {
  const pathname = usePathname();
  const active = matchTab(pathname);

  return (
    <nav aria-label="Main navigation tabs" style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'center', height: '100%' }}>
      {TABS.map(t => (
        <Link
          key={t.id}
          href={t.href}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            height: '100%',
            borderBottom: `3px solid ${active === t.id ? 'var(--accent, #ff5029)' : 'transparent'}`,
            fontFamily: "var(--font-display, 'Syne', sans-serif)",
            fontSize: '1rem',
            fontWeight: 800,
            letterSpacing: '-0.01em',
            color: active === t.id ? 'var(--ink, #f0ebe5)' : 'rgba(240,235,229,0.5)',
            textDecoration: 'none',
            transition: 'color 150ms cubic-bezier(0.2,0.7,0.3,1), border-color 150ms cubic-bezier(0.2,0.7,0.3,1)',
            whiteSpace: 'nowrap',
          }}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
