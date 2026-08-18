import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import type { Metadata } from 'next';
import { PagesHome } from '@/components/PagesHome';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dashboard · iHYPE',
  description: 'Your pages, creator tools, audience signal, and local music network.',
  robots: { index: false, follow: false },
};

export default async function PagesPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; profile?: string; editor?: string; tool?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/app/me/profiles');
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  return (
    <PagesHome
      initialEditorSection={resolvedSearchParams.editor}
      initialProfileId={resolvedSearchParams.profile}
      initialTab={resolvedSearchParams.tab}
      initialTool={resolvedSearchParams.tool}
    />
  );
}
