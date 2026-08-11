'use client';

import {
  Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useMobileShell } from '@/lib/MobileShellContext';
import { AppShellHeader } from '@/components/shell/AppShellHeader';
import { AppShellContextStrip } from '@/components/shell/AppShellContextStrip';
import { AppShellDrawer } from '@/components/shell/AppShellDrawer';
import { AppShellActiveProvider } from '@/components/shell/AppShellContext';
import { ShellBackPill } from '@/components/shell/ShellBackPill';
import { ShellScrollManager } from '@/components/shell/ShellScrollManager';
import {
  buildShellNav, isShellRoute, resolveActiveItemId, resolveSection,
  type ShellAccount, type ShellNavItem, type ShellSectionId,
} from '@/lib/app-nav';
import { isMmmRoute } from '@/lib/mmm-nav';
import { setAppShellChromeActive } from '@/lib/shell-chrome';

/**
 * The signed-in app shell — one screen, chrome that never remounts.
 *
 * ## The chrome contract (from the handoff; these are rules, not suggestions)
 *
 * 1. The top bar and the player never re-render on navigation. This component
 *    lives in the ROOT layout, so Next.js preserves it across route changes:
 *    only `children` is replaced. The player is `SitePlayerDock`, also in the
 *    root layout, and is deliberately not a child of this component.
 * 2. The content region is the only scroll container — `position: absolute;
 *    inset: <mainTop> 0 <playerOffset> 0; overflow-y: auto`. `html`/`body` do
 *    not scroll (locked by `.ihype-shell-locked` in shell.css).
 * 3. Header auto-hide is driven by the CONTENT container's `scrollTop`, never
 *    `window.scrollY`. Threshold 24px.
 * 4. Auto-hide only applies to mobile surfaces. Desktop chrome is always
 *    visible.
 * 5–7. The drawer's and content region's edges come from CSS custom
 *    properties, so the player's presence moves both at once and hiding the
 *    player zeroes both (`body:has(.site-dock)` in shell.css).
 * 8. Nothing here paints a hardcoded color.
 *
 * ## What it wraps, and what it deliberately does not
 *
 * Shell routes come from the route registry in `src/lib/app-nav.ts`. Marketing
 * and auth surfaces keep the existing header/footer chrome — the handoff scopes
 * this to "the signed-in iHYPE experience".
 *
 * `/listen` owns the new full-screen module deck at every viewport, including
 * its own header, navigation, scroll surface and player. It therefore always
 * stands outside this legacy shell. So does `/app/*` — the Music · Map · Me
 * shell (DESIGN_SYNC row 267), which has no header or tab bar at all and locks
 * document scroll itself. On phone widths, `/shows` and `/pages` have a
 * purpose-built swipe shell (`MobileAppShell`, which scroll-locks the body and
 * holds all three sections permanently mounted). Two shells cannot both own the
 * scroll container, so this one stands aside while that one is active. That is
 * also the shape backlog item 6 asks for ("at phone width the drawer should
 * likely become bottom tabs"), which is exactly what MobileBottomNav already
 * is — so it stays visible there and the content region reserves room for it.
 */
export function AppShell({
  account,
  unreadCount,
  footer,
  children,
}: {
  /** Null when nobody is signed in. */
  account: ShellAccount | null;
  unreadCount: number;
  /** The existing site footer, rendered only in the non-shell fallback. */
  footer: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { status: sessionStatus } = useSession();
  const mobileShell = useMobileShell();

  const [menuOpen, setMenuOpen] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  // `openSection` is derived from the route; a user toggle overrides it until
  // the next navigation. Storing the override (not the value) is what makes
  // "opening a route also expands the section that owns it" free.
  const [sectionOverride, setSectionOverride] = useState<ShellSectionId | null | undefined>(undefined);

  const contentRef = useRef<HTMLElement | null>(null);

  const activeSection = resolveSection(pathname);
  const shellEligible = Boolean(account) && sessionStatus === 'authenticated' && isShellRoute(pathname);
  // Two surfaces own their own full-screen chrome and must not be wrapped:
  // `/listen` (the module deck) and `/app/*` (the Music/Map/Me shell, which
  // scroll-locks the document itself — two shells cannot both own the scroll
  // container). See the note above and DESIGN_SYNC row 267.
  const dedicatedModuleDeck = pathname === '/listen' || isMmmRoute(pathname);
  const active = shellEligible && !dedicatedModuleDeck && !mobileShell?.active;

  const items = useMemo<ShellNavItem[]>(
    () => (account ? buildShellNav(account) : []),
    [account],
  );

  // Route change closes the drawer and drops any accordion override.
  useEffect(() => {
    setMenuOpen(false);
    setSectionOverride(undefined);
  }, [pathname]);

  // Toggling the html class (rather than styling from a wrapper) is what lets
  // shell.css lock document scroll and stand the marketing chrome down without
  // either of those needing to know this component exists.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('ihype-shell-locked', active);
    // Published in the same effect on purpose: the header is stood down
    // visually by that class and stands its drawer down by this flag, so the
    // two can never disagree. See src/lib/shell-chrome.ts.
    setAppShellChromeActive(active);
    return () => {
      root.classList.remove('ihype-shell-locked');
      setAppShellChromeActive(false);
    };
  }, [active]);

  // Contract rule 3 + 4: content scrollTop, threshold 24, mobile only.
  useEffect(() => {
    if (!active) {
      setHeaderHidden(false);
      return;
    }
    const node = contentRef.current;
    if (!node) return;

    const query = window.matchMedia('(max-width: 768px)');
    let frame = 0;
    const update = () => {
      frame = 0;
      setHeaderHidden(query.matches && node.scrollTop > 24);
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };
    update();
    node.addEventListener('scroll', onScroll, { passive: true });
    query.addEventListener('change', update);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      node.removeEventListener('scroll', onScroll);
      query.removeEventListener('change', update);
    };
  }, [active, pathname]);

  const toggleSection = useCallback((section: ShellSectionId) => {
    setSectionOverride((current) => {
      const shown = current === undefined ? activeSection : current;
      return shown === section ? null : section;
    });
  }, [activeSection]);

  if (!active) {
    return (
      <AppShellActiveProvider value={false}>
        <div className="site-shell">
          <main id="main-content">{children}</main>
          {footer}
        </div>
      </AppShellActiveProvider>
    );
  }

  const openSection = sectionOverride === undefined ? activeSection : sectionOverride;

  return (
    <AppShellActiveProvider value={true}>
    <div className="shell-root" data-header-hidden={headerHidden ? 'true' : 'false'}>
      {/* useSearchParams needs a Suspense boundary; the shared UI state that
          the header, strip and drawer all read lives above it. */}
      <Suspense fallback={null}>
        <ShellChrome
          account={account!}
          activeSection={activeSection}
          items={items}
          menuOpen={menuOpen}
          onCloseMenu={() => setMenuOpen(false)}
          onToggleMenu={() => setMenuOpen((open) => !open)}
          onToggleSection={toggleSection}
          openSection={openSection}
          unreadCount={unreadCount}
        />
        <ShellScrollManager contentRef={contentRef} />
      </Suspense>

      <main className="shell-content" id="main-content" ref={contentRef}>
        <div className="shell-content-inner">
          <Suspense fallback={null}>
            <ShellBackPill items={items} />
          </Suspense>
          {children}
        </div>
      </main>
    </div>
    </AppShellActiveProvider>
  );
}

function ShellChrome({
  account,
  activeSection,
  items,
  menuOpen,
  onCloseMenu,
  onToggleMenu,
  onToggleSection,
  openSection,
  unreadCount,
}: {
  account: ShellAccount;
  activeSection: ShellSectionId;
  items: ShellNavItem[];
  menuOpen: boolean;
  onCloseMenu: () => void;
  onToggleMenu: () => void;
  onToggleSection: (section: ShellSectionId) => void;
  openSection: ShellSectionId | null;
  unreadCount: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeItemId = resolveActiveItemId(items, pathname, searchParams.get('tab'));

  return (
    <>
      <AppShellHeader
        accountName={account.name}
        initialQuery={searchParams.get('q') ?? ''}
        menuOpen={menuOpen}
        onToggleMenu={onToggleMenu}
        unreadCount={unreadCount}
      />
      <AppShellContextStrip activeItemId={activeItemId} items={items} section={activeSection} />
      <AppShellDrawer
        activeItemId={activeItemId}
        items={items}
        onClose={onCloseMenu}
        onToggleSection={onToggleSection}
        open={menuOpen}
        openSection={openSection}
      />
    </>
  );
}
