import './globals.css';
import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';
import { AppProviders } from '@/components/AppProviders';
import { HeaderAuthLinks } from '@/components/HeaderAuthLinks';
import { HeaderUserMenu } from '@/components/HeaderUserMenu';
import { HeaderLogo } from '@/components/HeaderLogo';
import { PwaInstallPrompt } from '@/components/PwaInstallPrompt';
import { WebPushPrompt } from '@/components/WebPushPrompt';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { NavDrawer } from '@/components/NavDrawer';
import { SearchBar } from '@/components/SearchBar';
import { SiteNavTabs } from '@/components/SiteNavTabs';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { OfflineBanner } from '@/components/OfflineBanner';
import { MiniPlayer } from '@/components/MiniPlayer';
import { WebVitals } from '@/components/WebVitals';


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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppProviders>
          <WebVitals />
          <OfflineBanner />
          <div aria-hidden="true" className="site-background">
            <span className="site-background-orb site-background-orb-a" />
            <span className="site-background-orb site-background-orb-b" />
            <span className="site-background-grid" />
          </div>
          {/* Marketing nav — hidden when .wb-shell is present via CSS */}
          <header aria-label="Primary site header" className="nav site-nav" style={{ height: 56 }}>
            <div className="container" style={{ display: 'flex', alignItems: 'stretch', height: '100%', gap: '1rem' }}>
              <HeaderLogo />
              <div style={{ flex: 1, display: 'flex', alignItems: 'stretch' }}>
                <SiteNavTabs />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <HeaderAuthLinks />
                <HeaderUserMenu />
              </div>
              <NavDrawer />
            </div>
          </header>
          <MobileBottomNav />
          <div className="site-shell">
            {children}
          </div>
          <MiniPlayer />
          <PwaInstallPrompt />
          <WebPushPrompt />
          <ServiceWorkerRegister />

        </AppProviders>
      </body>
    </html>
  );
}
