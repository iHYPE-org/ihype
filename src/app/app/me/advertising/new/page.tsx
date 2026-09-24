import { CampaignBuilderGate } from '@/components/advertise/CampaignBuilderGate';
import { isNativeAppRequest } from '@/lib/native-app-server';

export const dynamic = 'force-dynamic';

/* The builder in a browser; "build it on the web" in the iOS and Android apps
   (DESIGN_SYNC row 514). The user agent is read here so a current store build
   never paints the builder, and the gate re-checks on the client for an older
   build that predates the token. */
export default async function MmmNewCampaignPage() {
  return <CampaignBuilderGate initialNative={await isNativeAppRequest()} />;
}
