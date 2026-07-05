import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import type { Metadata } from 'next';
import { PagesHome } from '@/components/PagesHome';
import { RouteShellSlot } from '@/components/RouteShellSlot';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pages · iHYPE',
  description: 'Your public page, the creator, and every artist, venue, and DJ on iHYPE.',
  robots: { index: false, follow: false },
};

export default async function PagesPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/pages');
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  return <RouteShellSlot><PagesHome initialTab={resolvedSearchParams.tab} /></RouteShellSlot>;
}
