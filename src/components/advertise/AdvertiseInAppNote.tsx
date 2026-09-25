'use client';

import { useI18n } from '@/components/I18nProvider';
import { useNativeApp } from '@/components/advertise/useNativeApp';

/**
 * One sentence the landing page adds inside the iOS and Android apps, and
 * nowhere else: signing up and reading the price list work here, building and
 * paying for a campaign happens on the web (row 514). A browser reader is
 * already on the web and would read it as noise.
 */
export function AdvertiseInAppNote({ initialNative }: { initialNative: boolean }) {
  const { t } = useI18n();
  const native = useNativeApp(initialNative);
  if (!native) return null;
  return (
    <p className="mmm-ad-in-app-note" data-web-only="landing-note">
      {t('advertiseInAppNote.body', 'In the app you can create your advertiser account and see pricing. Campaigns are built and paid for on the web at ihype.org/advertise.')}
    </p>
  );
}
