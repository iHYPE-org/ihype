import './globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { Syne, DM_Sans, JetBrains_Mono } from 'next/font/google';
import { AppProviders } from '@/components/AppProviders';
import { HeaderAuthLinks } from '@/components/HeaderAuthLinks';
import { HeaderLogo } from '@/components/HeaderLogo';
import { PwaInstallPrompt } from '@/components/PwaInstallPrompt';
import { CookieConsent } from '@/components/CookieConsent';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { ThemeToggle } from '@/components/ThemeToggle';
import { BottomTabBar } from '@/components/BottomTabBar';
import { NavDrawer } from '@/components/NavDrawer';
import { SearchBar } from '@/components/SearchBar';
import { BugReportButton } from '@/components/BugReportButton';
import { OfflineBanner } from '@/components/OfflineBanner';
import { MiniPlayer } from '@/components/MiniPlayer';
import { PushPrompt } from '@/components/PushPrompt';
import { A2HSPrompt } from '@/components/A2HSPrompt';

const syne = Syne({ subsets: ['latin'], weight: ['600','700','800'], variable: '--font-syne', display: 'swap' });
const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400','500','600','700'], variable: '--font-dm', display: 'swap' });
const jbMono = JetBrains_Mono({ subsets: ['latin'], weight: ['400','500','600'], variable: '--font-jb', display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'iHYPE.org',
    template: '%s · iHYPE'
  },
  description: 'Not-for-profit music discovery for artists, promoters, venues, and fans. 0% ticket fees. Free forever.',
  openGraph: {
    siteName: 'iHYPE',
    type: 'website',
    title: 'iHYPE — Independent music built for the scene',
    description: 'Not-for-profit music discovery for artists, promoters, venues, and fans. 0% ticket fees. Free forever.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'iHYPE — Independent music built for the scene',
    description: 'Not-for-profit music discovery for artists, promoters, venues, and fans. 0% ticket fees. Free forever.',
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || 'https://ihype.org'
  )
};
