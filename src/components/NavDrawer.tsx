'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';

const primaryLinks = [
  { href: '/home',     label: 'Home' },
  { href: '/discover', label: 'Seeds' },
  { href: '/shows',    label: 'Shows' },
  { href: '/settings', label: 'You' },
];

const secondaryLinks = [
  { href: '/about', label: 'About' },
  { href: '/transparency', label: 'Transparency' },
  { href: '/advertise', label: 'Advertise' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/dmca', label: 'DMCA' },
  { href: '/status', label: 'Status' },
  { href: '/playlists', label: 'Playlists' },
  { href: '/collab', label: 'Collab' },
  { href: '/feedback', label: 'Feedback' },
  { href: '/discover?tab=fans', label: 'Leaderboard' },
];

export function NavDrawer() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <button
        className="nav-drawer-trigger"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        ☰
      </button>
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
            <ul className="nav-drawer-list">
              {primaryLinks.map((link) => {
                const isActive = pathname === link.href || (link.href !== '/home' && pathname.startsWith(link.href));
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={`nav-drawer-link nav-drawer-link--primary${isActive ? ' active' : ''}`}
                      onClick={() => setOpen(false)}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
              <li className="nav-drawer-divider" aria-hidden="true" />
              {secondaryLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="nav-drawer-link"
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div style={{ borderTop: '1px solid var(--line)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, opacity: 0.5 }}>Theme</span>
              <ThemeToggle />
            </div>
          </nav>
        </>
      )}
    </>
  );
}
