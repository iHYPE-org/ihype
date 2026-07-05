'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { pathToSection, sectionToPath, type ShellSection } from '@/lib/mobileShell';

type MobileShellValue = {
  /** True only on mobile viewports while sitting on one of the 3 shell routes — gates both the shell's own visibility and whether each route's own page content should render (it shouldn't, the shell already has a mounted copy). */
  active: boolean;
  section: ShellSection;
  setSection: (section: ShellSection) => void;
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
  const [isMobile, setIsMobile] = useState(false);
  const [section, setSectionState] = useState<ShellSection>(() => pathToSection(pathname) ?? 'listen');

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

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

  const active = isMobile && pathToSection(pathname) !== null;

  return (
    <MobileShellCtx.Provider value={{ active, section, setSection }}>
      {children}
    </MobileShellCtx.Provider>
  );
}

/** Returns null outside the provider (defensive; the provider always wraps the app). */
export function useMobileShell() {
  return useContext(MobileShellCtx);
}
