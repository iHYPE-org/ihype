'use client';

import { useEffect, useState } from 'react';
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
  const [scrolled, setScrolled] = useState(false);

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
        <SearchBar compact={scrolled} />
        <div className="adaptive-site-header-tabs">
          <SiteNavTabs />
        </div>
        <ThemeToggle />
        <div className="adaptive-site-header-auth">
          <HeaderAuthLinks inviteOnly={inviteOnly} />
        </div>
      </div>
    </header>
  );
}
