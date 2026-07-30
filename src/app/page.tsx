import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { FanFirstLanding } from '@/components/FanFirstLanding';
import { getBaseUrl } from '@/lib/utils';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';

const TITLE = 'iHYPE — Your local music scene, completely free';
const DESCRIPTION = 'Discover independent artists and live shows near you, hype the moments you love, and grab tickets with zero fees.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: getBaseUrl() },
  openGraph: {
    type: 'website',
    siteName: 'iHYPE',
    title: TITLE,
    description: DESCRIPTION,
    url: getBaseUrl(),
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export default async function RootPage() {
  const session = await auth();
  if (session?.user?.id) redirect(WORKBENCH_PATH);

  return <FanFirstLanding />;
}
