'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

const IcBolt = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);
const IcHeart = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 21s-7-4.5-9.5-9.2C.8 8.2 3 4.5 6.5 4.5c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3C21 4.5 23.2 8.2 21.5 11.8 19 16.5 12 21 12 21z" />
  </svg>
);
const IcRadio = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="2" y="9" width="20" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M6 9l6-7 6 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="15" r="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M17 12h1M6 12h1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const IcCalendar = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);
const IcUser = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.7" />
    <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

const BASE_TABS = [
  { label: 'Home',  href: '/home',     Icon: IcBolt },
  { label: 'Seeds', href: '/discover', Icon: IcHeart },
  { label: 'Shows', href: '/shows',    Icon: IcCalendar },
  { label: 'You',   href: '/settings', Icon: IcUser },
];

const RADIO_TAB = { label: 'Radio', href: '/radio', Icon: IcRadio };

// Roles that get the Radio tab
const RADIO_ROLES = new Set(['DJ', 'PROMOTER', 'ADMIN']);

export function BottomTabBar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  // Hide on workbench (has its own nav)
  if (pathname.startsWith('/workbench')) return null;

  const role = (session?.user as { role?: string } | undefined)?.role ?? '';
  const showRadio = RADIO_ROLES.has(role);

  // Insert Radio tab between Seeds and Shows for eligible roles
  const tabs = showRadio
    ? [BASE_TABS[0], BASE_TABS[1], RADIO_TAB, BASE_TABS[2], BASE_TABS[3]]
    : BASE_TABS;

  return (
    <nav className="bottom-tab-bar" aria-label="Mobile navigation">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || (tab.href !== '/home' && pathname.startsWith(tab.href));
        return (
          <Link
            key={tab.label}
            href={tab.href}
            className={`bottom-tab-item${isActive ? ' active' : ''}`}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <div className={`bottom-tab-pill${isActive ? ' active' : ''}`}>
              <tab.Icon size={22} />
            </div>
            <span className="bottom-tab-label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
