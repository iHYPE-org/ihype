import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { RadioStudio } from '@/components/RadioStudio';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Radio Studio',
  description: 'Build and publish radio shows — drag-and-drop tracks, voice overs, and samples.',
};

export default async function RadioStudioPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/radio/studio');
  }
  const role = (session.user as { role?: string }).role ?? '';
  if (role !== 'DJ' && role !== 'PROMOTER' && role !== 'ADMIN') {
    redirect('/radio');
  }
  return <RadioStudio />;
}
