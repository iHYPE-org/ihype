'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { pathToSection, sectionToPath, SHELL_SECTIONS, type ShellSection } from '@/lib/mobileShell';

const MOBILE_MEDIA_QUERY = '(max-width: 768px)';

function subscribeToMobileQuery(onChange: () => void) {
  const mq = window.matchMedia(MOBILE_MEDIA_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function getIsMobileSnapshot() {
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

function getIsMobileServerSnapshot() {
  return false;
}

type MobileShellValue = {
  /** True only on mobile viewports while sitting on one of the 3 shell routes — gates both the shell's own visibility and whether each route's own page content should render (it shouldn't, the shell already has a mounted copy). */
  active: boolean;
  section: ShellSection;
  setSection: (section: ShellSection) => void;
  /** Moves to the next/previous section in the 3-item loop — shared by MobileAppShell's live drag-follow carousel (content view) and MobileQuickGrid's own swipe detection (grid view, which is portaled outside the carousel's DOM subtree and so needs its own gesture handling). */
  swipeSection: (direction: 'next' | 'prev') => void;
  /** Bumped per-section each time goToSectionHome targets that section — each *Home component watches its own entry to reset back to its grid/landing view. */
  resetTokens: Record<ShellSection, number>;
  /** Switches to (or stays on) a section AND resets it back to its grid/landing view — used by the bottom nav so tapping a tab always returns to that section's home, even if you're drilled into a sub-tab. */
  goToSectionHome: (section: ShellSection) => void;
};

const MobileShellCtx = createContext<MobileShellValue | null>(null);

/**
 * Lives in the root layout (persists across navigation, unlike page.tsx
 * content) so Listen/Events/Pages can stay mounted in MobileAppShell
 * regardless of which of the 3 routes is currently active, and swiping
 * between them never triggers a real Next.js navigation once the shell
 * has taken over.
 */
export function MobileShellProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // useSyncExternalStore (not useState+useEffect) matters here: it resolves
  // to the real client value synchronously during hydration, in the same
  // commit, before the browser paints. A useEffect-based check would paint
  // the desktop-shaped page first and only flip to the mobile shell a frame
  // later — a real, visible layout jump (confirmed via Lighthouse CLS audits
  // showing the whole page moving from a footer's true position) rather than
  // just a hydration nuance.
  const isMobile = useSyncExternalStore(subscribeToMobileQuery, getIsMobileSnapshot, getIsMobileServerSnapshot);
  const [section, setSectionState] = useState<ShellSection>(() => pathToSection(pathname) ?? 'listen');
  const [resetTokens, setResetTokens] = useState<Record<ShellSection, number>>({ listen: 0, shows: 0, pages: 0 });

  // A real navigation (bottom-nav tap before hydration, a Link elsewhere in
  // the app, browser back/forward) should still move the shell to match.
  useEffect(() => {
    const s = pathToSection(pathname);
    if (s) setSectionState(s);
  }, [pathname]);

  const setSection = useCallback((next: ShellSection) => {
    setSectionState(next);
    const path = sectionToPath(next);
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
  }, []);

  const goToSectionHome = useCallback((next: ShellSection) => {
    setSection(next);
    setResetTokens((prev) => ({ ...prev, [next]: prev[next] + 1 }));
  }, [setSection]);

  const swipeSection = useCallback((direction: 'next' | 'prev') => {
    const idx = SHELL_SECTIONS.indexOf(section);
    const len = SHELL_SECTIONS.length;
    const nextIdx = (idx + (direction === 'next' ? 1 : -1) + len) % len;
    setSection(SHELL_SECTIONS[nextIdx]);
  }, [section, setSection]);

  const active = isMobile && pathToSection(pathname) !== null;

  const value = useMemo(
    () => ({ active, section, setSection, swipeSection, resetTokens, goToSectionHome }),
    [active, section, setSection, swipeSection, resetTokens, goToSectionHome]
  );

  return (
    <MobileShellCtx.Provider value={value}>
      {children}
    </MobileShellCtx.Provider>
  );
}

/** Returns null outside the provider (defensive; the provider always wraps the app). */
export function useMobileShell() {
  return useContext(MobileShellCtx);
}
