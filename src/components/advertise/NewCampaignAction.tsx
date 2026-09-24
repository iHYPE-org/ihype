'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';
import { openOnWeb } from '@/components/advertise/openOnWeb';
import { useNativeApp } from '@/components/advertise/useNativeApp';
import { WEB_CAMPAIGN_PATH } from '@/lib/native-app';

/**
 * The dashboard's primary key: "+ New Campaign" in a browser, "New campaign on
 * the web" in the iOS and Android apps, which opens the builder in a browser
 * tab rather than inside the app (row 514).
 */
export function NewCampaignAction({ initialNative }: { initialNative: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const native = useNativeApp(initialNative);

  if (!native) {
    return (
      <Link href={WEB_CAMPAIGN_PATH} className="mmm-btn-primary mmm-advertiser-new">
        {t('advertiseDashboardPage.newCampaign', '+ New Campaign')}
      </Link>
    );
  }

  return (
    <button
      className="mmm-btn-primary mmm-advertiser-new"
      data-web-only="new-campaign"
      onClick={() => void openOnWeb(WEB_CAMPAIGN_PATH, { onReturn: () => router.refresh() })}
      type="button"
    >
      {t('newCampaignAction.onTheWeb', 'New campaign on the web')}
    </button>
  );
}
