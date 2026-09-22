'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { IhypeMark } from '@/components/brand/IhypeMark';
import { HeaderAuthLinks } from '@/components/HeaderAuthLinks';
import { HeaderLogo } from '@/components/HeaderLogo';
import { SearchBar } from '@/components/SearchBar';
import { useI18n } from '@/components/I18nProvider';
import { MMM_NAV, moduleForPath } from '@/lib/mmm-nav';
import { translateTabLabel } from '@/lib/mmm-shell-labels';

/**
 * THE ONE HEADER, and since 2026-09-22 the whole of the signed-in navigation.
 *
 * (Owner: "The chrome button bottom nav is no longer the direction we're going
 * for the design of this app. You can remove those components to save space",
 * then, asked how a member reaches the other three modules: "Slim top header —
 * the mark on the left, the four destinations as text links on the right, the
 * same header the public pages already use, so the whole product has one
 * header".)
 *
 * Before this date there were THREE navigations for one signed-in member: the
 * walnut dock inside `/app/*` (four tabs and a mini player, 55px + safe area on
 * every screen), `SiteTabBar` along the bottom of every public page (Listen ·
 * Events · Dashboard, in dark literals no theme could reach), and this header,
 * which the shell HID under `html.mmm-locked`. The dock and the tab bar are
 * deleted; this header renders inside the shell now, and the frame starts
 * below it (`--app-header-h` in globals.css is the one figure both read).
 *
 * ## What is wired, and where each piece came from
 *
 *  - **The four destinations are `MMM_NAV`**, the same manifest the dock read,
 *    drawn as text links with `aria-current` on the one whose module
 *    `moduleForPath` resolves for the current path. Labels translate at the
 *    draw through `translateTabLabel`, keyed on the module id, exactly as the
 *    dock did — the manifest stays pure.
 *  - **The commit rescue** moved here from `MmmDock.tsx`. A soft `router.push`
 *    from a detail route under the `/app` layout sometimes never commits
 *    (DESIGN_SYNC row 309): the click lands, the router accepts it, the URL
 *    does not move. Each link arms a 1.2s timer and hard-assigns if the path
 *    has not changed by then; the effect keyed on `pathname` cancels it the
 *    moment the soft navigation commits, so the fast path costs nothing.
 *    Modified clicks are left alone — a cmd-click opens a tab and must not
 *    also navigate this one. This bar is the app's only navigation; without
 *    the rescue a member tapping Me from an artist page stayed on the artist
 *    page, which CI caught the first time the rescue was dropped.
 *  - **Inside the shell the header is SLIM** (`is-app`: `--app-header-h`, no
 *    search field, no gear). The document under `/app/*` cannot scroll, so the
 *    76→54 scroll behaviour the public pages have would never fire there, and
 *    Listen carries its own search while Me carries Settings.
 *  - Signed in on a public page the search field and the gear stay, and the
 *    four links sit beside them; under 768px the field and the gear yield to
 *    the links, because 320px of header cannot hold a mark, four words, a
 *    field and a gear — and the tab bar this replaces carried no search either.
 *
 * `HeaderAuthLinks` (the account chip) and `HeaderLogo` (signed out) are
 * untouched.
 */
export function AdaptiveSiteHeader({
  inviteOnly,
  label,
}: {
  inviteOnly: boolean;
  label: string;
}) {
  const { t } = useI18n();
  const { status: sessionStatus } = useSession();
  const pathname = usePathname() ?? '/';
  const [scrolled, setScrolled] = useState(false);
  const signedIn = sessionStatus === 'authenticated';
  /* The shell: the frame below is `position: fixed` and starts at the header's
     bottom edge, and the document is locked, so this header is the only thing
     above the panes. */
  const inShell = pathname === '/app' || pathname.startsWith('/app/');
  const activeModule = moduleForPath(pathname);

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

  /* The commit rescue — see the header comment. */
  const pending = useRef<{ href: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  useEffect(() => {
    if (pending.current) {
      clearTimeout(pending.current.timer);
      pending.current = null;
    }
  }, [pathname]);
  const armCommitGuard = useCallback((event: React.MouseEvent, href: string) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = {
      href,
      timer: setTimeout(() => {
        pending.current = null;
        if (typeof window !== 'undefined' && window.location.pathname !== href) window.location.assign(href);
      }, 1200),
    };
  }, []);

  const classes = ['nav', 'site-nav', 'adaptive-site-header'];
  if (scrolled && !inShell) classes.push('is-scrolled');
  if (signedIn) classes.push('has-nav');
  if (inShell) classes.push('is-app');

  return (
    <header aria-label={label} className={classes.join(' ')}>
      <div className="adaptive-site-header-inner">
        {signedIn ? (
          <>
            <div className="app-menu-trigger-wrap">
              <Link aria-label={t('adaptiveSiteHeader.openApp', 'Open Music Map Me')} className="app-menu-logo" href="/app/map">
                {/* The mark, not the 1MB sticker this used to render at 54px —
                    at that size its tagline and TLD were illegible, so the file
                    was paying for detail nobody could resolve. */}
                <IhypeMark />
              </Link>
            </div>
            {!inShell && <SearchBar compact={scrolled} />}
            <div className="adaptive-site-header-spacer" />
            {/* The four destinations. `data-on` is what the stylesheet paints
                from and `aria-current` is what a reader hears; the e2e reads
                both, because they have disagreed before. */}
            <nav aria-label={t('mmmNav.main', 'Main')} className="site-nav-links">
              {MMM_NAV.map((module) => {
                const on = module.id === activeModule;
                return (
                  <Link
                    aria-current={on ? 'page' : undefined}
                    className="site-nav-link"
                    data-on={on}
                    href={module.href}
                    key={module.id}
                    onClick={(event) => armCommitGuard(event, module.href)}
                  >
                    {translateTabLabel(t, module.id, module.tabLabel)}
                  </Link>
                );
              })}
            </nav>
            {!inShell && (
              <Link aria-label={t('adaptiveSiteHeader.openSettings', 'Open settings')} className="app-settings-link" href="/app/me/settings" title={t('mmmStrip.settings', 'Settings')}>
                <svg aria-hidden="true" fill="none" height="19" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="19">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </Link>
            )}
            <div className="adaptive-site-header-auth">
              <HeaderAuthLinks inviteOnly={inviteOnly} />
            </div>
          </>
        ) : (
          <>
            <HeaderLogo />
            <div className="adaptive-site-header-spacer" />
            <div className="adaptive-site-header-auth">
              <HeaderAuthLinks inviteOnly={inviteOnly} />
            </div>
          </>
        )}
      </div>
    </header>
  );
}
