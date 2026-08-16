'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useI18n } from '@/components/I18nProvider';
import { BrandWordmark } from '@/components/BrandWordmark';

export function HeaderLogo() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { t } = useI18n();

  const href = session?.user ? '/home' : '/';

  return (
    <Link href={href} className="nav-logo nav-logo-right" aria-label={t('headerLogo.ariaLabel', 'iHYPE home')}>
      {/* The wordmark, per `guidelines/brand-wordmark-svg.card.html`: `i` in
          ink, `HYPE` — bolt included — in the accent. This used to be plain
          uppercase text whose winning rule painted `color: #fff`, so on a
          light page the `i` disappeared entirely. */}
      <BrandWordmark variant="brand" />
    </Link>
  );
}
