import type { Metadata } from 'next';
import { MmmAdvertiseLanding } from '@/components/mmm/MmmAdvertiseLanding';

export const metadata: Metadata = {
  title: 'Advertise · iHYPE',
  description: 'Reach music fans on iHYPE. Open to music-industry entities only — AI-vetted, transparent pricing.',
};

export default async function Page() {
  return <MmmAdvertiseLanding />;
}
