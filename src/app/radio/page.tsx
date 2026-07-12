import type { Metadata } from 'next';
import { toSafeJsonLdString } from '@/lib/safe-json-ld';
import { RadioHome } from '@/components/RadioHome';

export const metadata: Metadata = {
  title: 'Web Radio · iHYPE',
  description: 'Live audio-only DJ radio shows — tune in live, or replay any show anytime. Completely free, no video, no fees.',
  alternates: { canonical: '/radio' },
  openGraph: {
    title: 'iHYPE Web Radio — live DJ shows, audio only',
    description: 'Live audio-only DJ radio shows — tune in live, or replay any show anytime. Completely free.',
    url: '/radio',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'iHYPE Web Radio — live DJ shows, audio only',
    description: 'Live audio-only DJ radio shows — tune in live, or replay any show anytime.',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'RadioChannel',
  name: 'iHYPE Web Radio',
  url: 'https://ihype.org/radio',
  description: 'Live audio-only DJ radio shows. DJs go live and every show auto-saves for on-demand replay.',
  broadcastServiceTier: 'Free',
  inBroadcastLineup: {
    '@type': 'CableOrSatelliteService',
    name: 'ihype.org',
  },
};

export default function RadioPage() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: toSafeJsonLdString(jsonLd) }} type="application/ld+json" />
      <RadioHome />
    </>
  );
}
