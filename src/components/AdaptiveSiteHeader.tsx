'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { HeaderAuthLinks } from '@/components/HeaderAuthLinks';
import { HeaderLogo } from '@/components/HeaderLogo';
import { SearchBar } from '@/components/SearchBar';
import { SiteNavTabs } from '@/components/SiteNavTabs';
import { ThemeToggle } from '@/components/ThemeToggle';

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
      setScrolled(window.scrollY > 32);
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
        <HeaderLogo />
        {signedIn ? <SearchBar compact={scrolled} /> : null}
        {signedIn ? (
          <div className="adaptive-site-header-tabs">
            <SiteNavTabs />
          </div>
        ) : <div className="adaptive-site-header-spacer" />}
        <ThemeToggle />
        <div className="adaptive-site-header-auth">
          <HeaderAuthLinks inviteOnly={inviteOnly} />
        </div>
      </div>
    </header>
  );
}
