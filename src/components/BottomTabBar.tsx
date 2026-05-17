'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { label: 'Home', href: '/home', icon: '🏠' },
  { label: 'Discover', href: '/discover', icon: '✨' },
  { label: 'Shows', href: '/shows', icon: '🎵' },
  { label: 'Search', href: '/search', icon: '🔍' },
  { label: 'Profile', href: '/home', icon: '👤' },
];

export function BottomTabBar() {
  const pathname = usePathname();

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
            <span className="bottom-tab-icon">{tab.icon}</span>
            <span className="bottom-tab-label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
