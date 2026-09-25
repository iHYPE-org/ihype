'use client';

import { MmmCampaignBuilderPage } from '@/components/AdvertisePage';
import { CampaignsOnTheWeb } from '@/components/advertise/CampaignsOnTheWeb';
import { useNativeApp } from '@/components/advertise/useNativeApp';

/**
 * The builder on the web; the "build it on the web" page in the iOS and
 * Android apps (row 514). `initialNative` is the server's reading of the user
 * agent, so a current store build never renders the builder at all; an older
 * build without the token is caught by `window.Capacitor` one effect later.
 */
export function CampaignBuilderGate({ initialNative }: { initialNative: boolean }) {
  const native = useNativeApp(initialNative);
  return native ? <CampaignsOnTheWeb /> : <MmmCampaignBuilderPage />;
}
