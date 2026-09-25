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
  /* A signed-in member adds the advertiser profile to the account they already
     have, through the in-shell form — which itself forwards to the dashboard
     when the profile exists. Sending them to the dashboard directly created
     nothing: a member who tapped "Create advertiser account" landed on a
     dashboard for an account that did not exist (row 514). */
  if (session?.user?.id) {
    redirect('/app/me/advertising/start');
  }

  return <AdvertiserRegisterForm />;
}
