'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { HeaderAuthLinks } from '@/components/HeaderAuthLinks';
import { HeaderLogo } from '@/components/HeaderLogo';
import { AppShellDrawer } from '@/components/shell/AppShellDrawer';
import { SearchBar } from '@/components/SearchBar';
import { SiteNavTabs } from '@/components/SiteNavTabs';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  buildShellNav, resolveActiveItemId, resolveSection,
  type ShellAccount, type ShellSectionId,
} from '@/lib/app-nav';

export function AdaptiveSiteHeader({
  account,
  inviteOnly,
  label,
}: {
  /**
   * The viewer, for the drawer's nav. Null when signed out or unreadable, in
   * which case the menu has nothing to list and is not rendered — the header's
   * sign-in links are the whole menu for a visitor.
   */
  account: ShellAccount | null;
  inviteOnly: boolean;
  label: string;
}) {
  const { data: session, status: sessionStatus } = useSession();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuDemo, setMenuDemo] = useState(false);
  const pathname = usePathname();
  // Opens on the section you are already in, so the menu answers "where else
  // can I go from here" rather than making you find your own place first.
  const [openSection, setOpenSection] = useState<ShellSectionId | null>(null);
  // One source for both drawers. Memoised on `account` because buildShellNav
  // walks the registry and the header re-renders on every scroll tick.
  const navItems = useMemo(() => (account ? buildShellNav(account) : []), [account]);
  const activeItemId = resolveActiveItemId(navItems, pathname, null);
  const currentSection = resolveSection(pathname);
  const signedIn = sessionStatus === 'authenticated';

  useEffect(() => {
    let scheduled = false;
    const update = () => {
      setScrolled(window.scrollY > 8);
      scheduled = false;
    };
    const onScroll = () => {
      if (!scheduled) {
        scheduled = true;
        window.requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const storageKey = 'ihype-menu-introduced-this-signin';
    if (!signedIn) {
      try { window.sessionStorage.removeItem(storageKey); } catch {}
      return;
    }
    try {
      if (window.sessionStorage.getItem(storageKey) === session?.user?.id) return;
      window.sessionStorage.setItem(storageKey, session?.user?.id ?? 'signed-in');
    } catch {
      // Storage can be disabled; the sign-in demo still works for this view.
    }

    const openTimer = window.setTimeout(() => {
      setMenuDemo(true);
      setMenuOpen(true);
    }, 300);
    const closeTimer = window.setTimeout(() => {
      setMenuOpen(false);
      setMenuDemo(false);
    }, 3500);
    return () => {
      window.clearTimeout(openTimer);
      window.clearTimeout(closeTimer);
    };
  }, [session?.user?.id, signedIn]);

  return (
    <header
      aria-label={label}
      className={`nav site-nav adaptive-site-header${scrolled ? ' is-scrolled' : ''}`}
    >
      <div className="adaptive-site-header-inner">
        {signedIn ? (
          <>
            <div className="app-menu-trigger-wrap">
              <button
                aria-expanded={menuOpen}
                aria-label="Open iHYPE menu"
                className={`app-menu-logo${menuDemo ? ' is-demoing' : ''}`}
                onClick={() => setMenuOpen((current) => !current)}
                type="button"
              >
                <Image alt="" height={54} priority src="/brand/ihype-menu-logo.webp" width={54} />
                <span className="app-menu-logo-signal" aria-hidden="true" />
              </button>
              {menuDemo ? <span className="app-menu-demo-label" role="status">Everything lives here</span> : null}
            </div>
            <SearchBar compact={scrolled} />
            <div className="adaptive-site-header-tabs">
              <SiteNavTabs />
            </div>
            <div className="adaptive-site-header-spacer" />
            <Link aria-label="Open settings" className="app-settings-link" href="/me/settings" title="Settings">
              <svg aria-hidden="true" fill="none" height="19" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="19">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
            <div className="adaptive-site-header-auth">
              <HeaderAuthLinks inviteOnly={inviteOnly} />
            </div>
            {/* The SAME drawer the app shell renders, from the SAME nav
                registry. It used to be `NavDrawer`, a second drawer with its
                own hand-written destination list — which still pointed LISTEN
                at `/listen?tab=…` months after DESIGN_SYNC row 273 moved those
                four to `/app/music/*`. Row 273 closed the one-way door in the
                shell's drawer and left this one open, and this is the drawer a
                phone actually sees, because the shell's chrome only exists on
                shell routes. */}
            {account && (
              <AppShellDrawer
                activeItemId={activeItemId}
                items={navItems}
                onClose={() => setMenuOpen(false)}
                onToggleSection={(section) =>
                  setOpenSection((current) => (current === section ? null : section))
                }
                open={menuOpen}
                openSection={openSection ?? currentSection}
              />
            )}
          </>
        ) : (
          <>
            <HeaderLogo />
            <div className="adaptive-site-header-spacer" />
            <ThemeToggle />
            <div className="adaptive-site-header-auth">
              <HeaderAuthLinks inviteOnly={inviteOnly} />
            </div>
          </>
        )}
      </div>
    </header>
  );
}
