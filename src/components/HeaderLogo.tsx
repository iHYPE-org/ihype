'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

function getDiscoverHref(pathname: string) {
  if (pathname.startsWith('/fans') || pathname.startsWith('/listeners')) {
    return '/fans';
  }

  if (pathname.startsWith('/artists')) {
    return '/artists';
  }

  if (pathname.startsWith('/promoters') || pathname.startsWith('/djs')) {
    return '/promoters';
  }

  if (pathname.startsWith('/venues')) {
    return '/venues';
  }

  return null;
}

export function HeaderLogo() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const discoverHref = getDiscoverHref(pathname);
  const showDiscoverCue = status === 'authenticated' && Boolean(session?.user) && Boolean(discoverHref);

  return (
    <Link
      href={showDiscoverCue ? discoverHref ?? '/' : '/'}
      className="nav-logo nav-logo-left"
      aria-label={showDiscoverCue ? 'Open discover page' : 'Go to iHYPE home'}
    >
      <span className="nav-logo-mark">
        <span className="nav-logo-word">iHYPE</span>
        <span className="nav-logo-dot">.org</span>
      </span>
      {showDiscoverCue ? <span className="nav-logo-discover">Discover</span> : null}
    </Link>
  );
}
