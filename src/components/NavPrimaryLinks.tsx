'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/shows', label: 'Shows' },
  { href: '/artists', label: 'Artists' },
  { href: '/venues', label: 'Venues' },
  { href: '/trending', label: 'Trending' },
  { href: '/journal', label: 'Journal' },
];

export function NavPrimaryLinks() {
  const pathname = usePathname();
  return (
    <nav className="nav-links nav-links-primary">
      {NAV_LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname.startsWith(href) ? 'page' : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
