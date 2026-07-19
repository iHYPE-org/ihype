import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AdvertiserRegisterForm } from '@/components/AdvertiserRegisterForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Open a 3rd-Party Advertiser Account · iHYPE',
  description: 'A self-serve account for music stores, merch printers, and live-production companies to manage ad campaigns on iHYPE — no artist, venue, or DJ account required.',
  robots: { index: false, follow: false },
};

export default async function AdvertiserRegisterPage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect('/advertise/dashboard');
  }

  return <AdvertiserRegisterForm />;
}
