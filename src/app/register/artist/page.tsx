import type { Metadata } from 'next';
import { ArtistQuickStartRegister } from '@/components/ArtistQuickStartRegister';

export const metadata: Metadata = {
  title: 'Artist Sign Up | iHYPE.org',
  description: 'Create an artist account with a faster quick-start flow, then upload music, choose visuals, and launch your page.',
  robots: {
    index: false,
    follow: false
  }
};

export default function ArtistRegisterPage() {
  return <ArtistQuickStartRegister />;
}
