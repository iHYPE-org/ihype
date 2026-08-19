'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { HeaderAuthLinks } from '@/components/HeaderAuthLinks';
import { HeaderLogo } from '@/components/HeaderLogo';
import { SearchBar } from '@/components/SearchBar';
import { SiteNavTabs } from '@/components/SiteNavTabs';

export function AdaptiveSiteHeader({
  inviteOnly,
  label,
}: {
  inviteOnly: boolean;
  label: string;
}) {
  const { status: sessionStatus } = useSession();
  const [scrolled, setScrolled] = useState(false);
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

  return (
    <header
      aria-label={label}
      className={`nav site-nav adaptive-site-header${scrolled ? ' is-scrolled' : ''}`}
    >
      <div className="adaptive-site-header-inner">
        {signedIn ? (
          <>
            <div className="app-menu-trigger-wrap">
              <Link aria-label="Open Music Map Me" className="app-menu-logo" href="/app/map">
                <Image alt="" height={54} priority src="/brand/ihype-menu-logo.webp" width={54} />
              </Link>
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
