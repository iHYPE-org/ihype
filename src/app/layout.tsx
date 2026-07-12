import './globals.css';
import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';
import { Syne, DM_Sans, JetBrains_Mono, Instrument_Serif, Forum } from 'next/font/google';
import { AppProviders } from '@/components/AppProviders';
import { HeaderAuthLinks } from '@/components/HeaderAuthLinks';
import { HeaderLogo } from '@/components/HeaderLogo';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { SearchBar } from '@/components/SearchBar';
import { SiteNavTabs } from '@/components/SiteNavTabs';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { OfflineBanner } from '@/components/OfflineBanner';
import { SitePlayerDock } from '@/components/GlobalMediaPlayer';
import { WebVitals } from '@/components/WebVitals';
import { SiteFooter } from '@/components/SiteFooter';
import { CookieConsent } from '@/components/CookieConsent';
import { AnalyticsBeacon } from '@/components/AnalyticsBeacon';
import { getCspNonce } from '@/lib/csp-nonce';
import { MobileShellProvider } from '@/lib/MobileShellContext';
import { MobileAppShellLoader } from '@/components/MobileAppShellLoader';
import { AppSplash } from '@/components/AppSplash';

const syne = Syne({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-syne', display: 'swap' });
const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-dm', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-jb', display: 'swap' });
const instrumentSerif = Instrument_Serif({ subsets: ['latin'], weight: ['400'], style: ['normal', 'italic'], variable: '--font-serif', display: 'swap' });
const forum = Forum({ subsets: ['latin'], weight: ['400'], variable: '--font-forum', display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'iHYPE.org',
    template: '%s · iHYPE'
  },
  description: 'Completely free. Not-for-profit music discovery for artists, promoters, venues, and fans. 0% ticket fees.',
  openGraph: {
    siteName: 'iHYPE',
    type: 'website',
    title: 'iHYPE — Independent music built for the scene',
    description: 'Completely free. Not-for-profit music discovery for artists, promoters, venues, and fans. 0% ticket fees.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'iHYPE — Independent music built for the scene',
    description: 'Completely free. Not-for-profit music discovery for artists, promoters, venues, and fans. 0% ticket fees.',
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

export default async function RootLayout({ children }: { children: ReactNode }) {
  const nonce = await getCspNonce();
  return (
    <html lang="en" suppressHydrationWarning className={`${syne.variable} ${dmSans.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable} ${forum.variable}`}>
      <body>
        <AppProviders>
          <MobileShellProvider>
            <AppSplash />
            <a href="#main-content" className="skip-to-content">Skip to main content</a>
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
                  <SearchBar />
                  <HeaderAuthLinks />
                </div>
              </div>
            </header>
            <MobileBottomNav />
            <MobileAppShellLoader />
            <div className="site-shell">
              <main id="main-content">{children}</main>
              <SiteFooter />
            </div>
            <SitePlayerDock />
            <CookieConsent />
            <ServiceWorkerRegister />
          </MobileShellProvider>
        </AppProviders>
        {process.env.NEXT_PUBLIC_CF_BEACON_TOKEN ? (
          <AnalyticsBeacon nonce={nonce} token={process.env.NEXT_PUBLIC_CF_BEACON_TOKEN} />
        ) : null}
      </body>
    </html>
  );
}
