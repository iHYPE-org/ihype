import type { Metadata } from 'next';
import { AdvertisePage } from '@/components/AdvertisePage';

export const metadata: Metadata = {
  title: 'Advertise · iHYPE',
  description: 'Reach music fans on iHYPE. Open to music-industry entities only — AI-vetted, transparent pricing.',
};

export default function Page() {
  return <AdvertisePage />;
}
