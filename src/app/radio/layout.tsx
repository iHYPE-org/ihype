import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'iHYPE Radio',
  description: 'The always-on iHYPE auto-DJ — free-use tracks from independent artists, around the clock. Audio only.',
  openGraph: {
    title: 'iHYPE Radio',
    description: 'A round-the-clock auto-DJ spinning free-use tracks from independent artists. Audio only.',
    siteName: 'iHYPE',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'iHYPE Radio',
    description: 'A round-the-clock auto-DJ spinning free-use tracks from independent artists. Audio only.',
  },
};

export default function RadioLayout({ children }: { children: ReactNode }) {
  return children;
}
