import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import type { Metadata } from 'next';
import { ListenHome } from '@/components/ListenHome';
import { RouteShellSlot } from '@/components/RouteShellSlot';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Listen · iHYPE',
  description: 'Discovery, radio, and charts — personalized for your taste.',
  robots: { index: false, follow: false },
};

export default async function ListenPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/listen');
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  return <RouteShellSlot><ListenHome initialTab={resolvedSearchParams.tab} /></RouteShellSlot>;
}
