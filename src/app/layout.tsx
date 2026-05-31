import './globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { AppProviders } from '@/components/AppProviders';
import { HeaderAuthLinks } from '@/components/HeaderAuthLinks';
import { HeaderLogo } from '@/components/HeaderLogo';
import { PwaInstallPrompt } from '@/components/PwaInstallPrompt';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { NavDrawer } from '@/components/NavDrawer';
import { SearchBar } from '@/components/SearchBar';
import { BugReportButton } from '@/components/BugReportButton';
import { OfflineBanner } from '@/components/OfflineBanner';
import { MiniPlayer } from '@/components/MiniPlayer';


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
  ),
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'iHYPE',
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppProviders>
          <OfflineBanner />
          <div aria-hidden="true" className="site-background">
            <span className="site-background-orb site-background-orb-a" />
            <span className="site-background-orb site-background-orb-b" />
            <span className="site-background-grid" />
          </div>
          {/* Marketing nav — hidden when .wb-shell is present via CSS */}
          <header aria-label="Primary site header" className="nav site-nav">
            <div className="container nav-inner-marketing">
              <HeaderLogo />
              <SearchBar />
              <HeaderAuthLinks />
              <NavDrawer />
            </div>
          </header>
          <div className="site-shell">
            {children}
          </div>
          <MiniPlayer />
          <BugReportButton />
          <PwaInstallPrompt />
          <ServiceWorkerRegister />

        </AppProviders>
      </body>
    </html>
  );
}
