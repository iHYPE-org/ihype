'use client';

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
      <span className="nav-logo-mark">
        <span className="nav-logo-word">i</span>
        <span className="nav-logo-dot">HYPE</span>
      </span>
    </Link>
  );
}
