'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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

export const adminPerspectiveOptions: Array<{ value: AdminPerspective; label: string; href: string }> = [
  { value: 'ADMIN', label: 'Admin', href: '/admin' },
  { value: 'LISTENER', label: 'Fan', href: '/fans?module=tool-hub' },
  { value: 'ARTIST', label: 'Artist', href: '/artists?module=tool-hub' },
  { value: 'PROMOTER', label: 'Promoter', href: '/promoters?module=tool-hub' },
  { value: 'VENUE', label: 'Venue', href: '/venues?module=tool-hub' }
];

const defaultNavItems: NavItem[] = [
  { href: '/', label: 'Discover', match: '/' },
  { href: '/artists', label: 'Artists', match: '/artists' },
  { href: '/promoters', label: 'Promoters', match: '/promoters' },
  { href: '/venues', label: 'Venues', match: '/venues' }
];

const perspectiveNavItems: Record<AdminPerspective, NavItem[]> = {
  ADMIN: [
    { href: '/home', label: 'Workbench', match: '/home' },
    { href: '/admin/verifications', label: 'Verifications', match: '/admin/verifications' },
    ...defaultNavItems
  ],
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

function getPerspectiveForPathname(pathname: string): AdminPerspective | null {
  if (pathname.startsWith('/admin')) return 'ADMIN';
  if (pathname.startsWith('/fans')) return 'LISTENER';
  if (pathname.startsWith('/artists')) return 'ARTIST';
  if (pathname.startsWith('/promoters')) return 'PROMOTER';
  if (pathname.startsWith('/venues')) return 'VENUE';
  return null;
}

export function AdminPerspectiveProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
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
      return;
    }

    const pathPerspective = getPerspectiveForPathname(pathname);
    if (pathPerspective) {
      setPerspectiveState(pathPerspective);
    }
  }, [isAdmin, pathname]);

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
  return adminPerspectiveOptions.find((option) => option.value === perspective)?.href ?? '/admin';
}

type AdminPerspectiveHeaderSelectProps = {
  className?: string;
};

export function AdminPerspectiveHeaderSelect({ className }: AdminPerspectiveHeaderSelectProps) {
  const router = useRouter();
  const { isAdmin, perspective, setPerspective } = useAdminPerspective();

  if (!isAdmin) {
    return null;
  }

  return (
    <label className={className ?? 'admin-perspective-select admin-perspective-select-header'}>
      <span>View as</span>
      <select
        onChange={(event) => {
          const nextPerspective = event.target.value as AdminPerspective;
          setPerspective(nextPerspective);
          router.push(getPerspectiveHomeHref(nextPerspective));
        }}
        value={perspective}
      >
        {adminPerspectiveOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AdminPerspectiveBar() {
  const pathname = usePathname();
  const router = useRouter();
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
          <select
            onChange={(event) => {
              const nextPerspective = event.target.value as AdminPerspective;
              setPerspective(nextPerspective);
              router.push(getPerspectiveHomeHref(nextPerspective));
            }}
            value={perspective}
          >
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
          <Link className="button small secondary" href="/home">
            Admin dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
