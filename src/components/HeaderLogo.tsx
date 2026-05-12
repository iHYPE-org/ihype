'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

export function HeaderLogo() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const href = session?.user ? '/home' : '/';

  return (
    <Link href={href} className="nav-logo nav-logo-right" aria-label="iHYPE home">
      <span className="nav-logo-mark">
        <span className="nav-logo-word">i</span>
        <span className="nav-logo-dot">HYPE</span>
      </span>
    </Link>
  );
}
