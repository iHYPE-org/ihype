'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';

export type AdminPerspective = 'ADMIN' | 'LISTENER' | 'ARTIST' | 'PROMOTER' | 'VENUE';

type NavItem = {
  href: string;
  label: string;
  match: string;
};

type AdminPerspectiveContextValue = {
  isAdmin: boolean;
  perspective: AdminPerspective;
  setPerspective: (perspective: AdminPerspective) => void;
};

const STORAGE_KEY = 'ihype-admin-perspective';

const AdminPerspectiveContext = createContext<AdminPerspectiveContextValue>({
  isAdmin: false,
  perspective: 'ADMIN',
  setPerspective: () => {}
});

const adminPerspectiveOptions: Array<{ value: AdminPerspective; label: string; href: string }> = [
  { value: 'ADMIN', label: 'Admin', href: '/dashboard' },
  { value: 'LISTENER', label: 'Fan', href: '/fans' },
  { value: 'ARTIST', label: 'Artist', href: '/artists' },
  { value: 'PROMOTER', label: 'Promoter', href: '/promoters' },
  { value: 'VENUE', label: 'Venue', href: '/venues' }
];

const defaultNavItems: NavItem[] = [
  { href: '/', label: 'Discover', match: '/' },
  { href: '/artists', label: 'Artists', match: '/artists' },
  { href: '/promoters', label: 'Promoters', match: '/promoters' },
  { href: '/venues', label: 'Venues', match: '/venues' }
];

const perspectiveNavItems: Record<AdminPerspective, NavItem[]> = {
  ADMIN: [{ href: '/dashboard', label: 'Dashboard', match: '/dashboard' }, ...defaultNavItems],
  LISTENER: [
    { href: '/', label: 'Discover', match: '/' },
    { href: '/artists', label: 'Artists', match: '/artists' },
    { href: '/promoters', label: 'Promoters', match: '/promoters' },
    { href: '/venues', label: 'Venues', match: '/venues' }
  ],
  ARTIST: [
    { href: '/', label: 'Discover', match: '/' },
    { href: '/artists', label: 'Artists', match: '/artists' },
    { href: '/promoters', label: 'Promoters', match: '/promoters' },
    { href: '/venues', label: 'Venues', match: '/venues' }
  ],
  PROMOTER: [
    { href: '/', label: 'Discover', match: '/' },
    { href: '/promoters', label: 'Promoters', match: '/promoters' },
    { href: '/artists', label: 'Artists', match: '/artists' },
    { href: '/venues', label: 'Venues', match: '/venues' }
  ],
  VENUE: [
    { href: '/', label: 'Discover', match: '/' },
    { href: '/venues', label: 'Venues', match: '/venues' },
    { href: '/artists', label: 'Artists', match: '/artists' },
    { href: '/promoters', label: 'Promoters', match: '/promoters' }
  ]
};

export function AdminPerspectiveProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';
  const [perspective, setPerspectiveState] = useState<AdminPerspective>('ADMIN');

  useEffect(() => {
    if (!isAdmin) {
      setPerspectiveState('ADMIN');
      return;
    }

    const storedPerspective = window.localStorage.getItem(STORAGE_KEY) as AdminPerspective | null;
    if (
      storedPerspective &&
      adminPerspectiveOptions.some((option) => option.value === storedPerspective)
    ) {
      setPerspectiveState(storedPerspective);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, perspective);
  }, [isAdmin, perspective]);

  const value = useMemo(
    () => ({
      isAdmin,
      perspective,
      setPerspective: setPerspectiveState
    }),
    [isAdmin, perspective]
  );

  return <AdminPerspectiveContext.Provider value={value}>{children}</AdminPerspectiveContext.Provider>;
}

export function useAdminPerspective() {
  return useContext(AdminPerspectiveContext);
}

export function getSiteNavItemsForPerspective(
  isAdmin: boolean,
  perspective: AdminPerspective
) {
  return isAdmin ? perspectiveNavItems[perspective] : defaultNavItems;
}

export function getPerspectiveHomeHref(perspective: AdminPerspective) {
  return adminPerspectiveOptions.find((option) => option.value === perspective)?.href ?? '/dashboard';
}

export function AdminPerspectiveBar() {
  const pathname = usePathname();
  const { isAdmin, perspective, setPerspective } = useAdminPerspective();

  if (!isAdmin || pathname.startsWith('/login') || pathname.startsWith('/register')) {
    return null;
  }

  const currentOption =
    adminPerspectiveOptions.find((option) => option.value === perspective) ?? adminPerspectiveOptions[0];

  return (
    <div className="admin-perspective-shell">
      <div className="container admin-perspective-bar">
        <div className="admin-perspective-copy">
          <div className="badge">Admin mode</div>
          <strong>{currentOption.label} perspective</strong>
          <span>Owner controls stay enabled while you browse the public experience for each user type.</span>
        </div>

        <label className="admin-perspective-select">
          <span>View as</span>
          <select onChange={(event) => setPerspective(event.target.value as AdminPerspective)} value={perspective}>
            {adminPerspectiveOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="admin-perspective-actions">
          <Link className="button small secondary" href={currentOption.href}>
            Open {currentOption.label}
          </Link>
          <Link className="button small secondary" href="/dashboard">
            Admin dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
