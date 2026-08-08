'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useI18n } from '@/components/I18nProvider';

export function HeaderLogo() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { t } = useI18n();

  const href = session?.user ? '/home' : '/';

  return (
    <Link href={href} className="nav-logo nav-logo-right" aria-label={t('headerLogo.ariaLabel', 'iHYPE home')}>
      {/* Was a CSS text lockup ("i" + "HYPE" in two spans). The signed-in nav
          has shown the drawn mark for as long as it has existed, so the two
          navs were rendering different logos — and the text one was painting
          from a stale layer at that: `.nav-logo-word` was defined twice with
          two different hardcoded creams, and `.nav-logo-dot` twice, the later
          of which coloured "HYPE" with a blue-and-gold gradient belonging to
          no palette in this codebase. One mark, one file, both navs.
          `unoptimized` for the reason given in AppShellHeader. */}
      <Image
        alt=""
        className="nav-logo-tile"
        height={44}
        priority
        src="/brand/ihype-logo-mark-compact.svg"
        unoptimized
        width={44}
      />
    </Link>
  );
}
