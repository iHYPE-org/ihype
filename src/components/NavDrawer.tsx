'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
