import './globals.css';
import './shell.css';
import './shell-surfaces.css';
import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';
import { Syne, DM_Sans, JetBrains_Mono, Instrument_Serif, Forum } from 'next/font/google';
import { AppProviders } from '@/components/AppProviders';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { OfflineBanner } from '@/components/OfflineBanner';
import { SitePlayerDock } from '@/components/GlobalMediaPlayer';
import { WebVitals } from '@/components/WebVitals';
import { SiteFooter } from '@/components/SiteFooter';
import { AnalyticsBeacon } from '@/components/AnalyticsBeacon';
import { getCspNonce } from '@/lib/csp-nonce';
import { MobileShellProvider } from '@/lib/MobileShellContext';
import { AppSplash } from '@/components/AppSplash';
import { getServerT } from '@/lib/i18n/server';

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
  const t = await getServerT();
  // Two reads that used to happen on EVERY page render are gone with the
  // header: `isInviteCodeRequiredRuntime()` (a KV read, for the header join
  // CTA's copy) and `getShellViewer()` (several DB queries, for the drawer's
  // badge counts). Neither has a consumer now. `getShellViewer` is still
  // exported and still used by anything that needs those counts — it is only
  // the unconditional per-request call that goes.
  const themeBootstrap = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.setAttribute('data-theme',t)}catch(e){}})();`;
  return (
    <html lang="en" suppressHydrationWarning className={`${syne.variable} ${dmSans.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable} ${forum.variable}`}>
      <head>
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeBootstrap }}
        />
      </head>
      <body>
        <AppProviders>
          <MobileShellProvider>
            <AppSplash />
            <a href="#main-content" className="skip-to-content">{t('layout.skipToContent', 'Skip to main content')}</a>
            <WebVitals />
            <OfflineBanner />
            <div aria-hidden="true" className="site-background">
              <span className="site-background-orb site-background-orb-a" />
              <span className="site-background-orb site-background-orb-b" />
              <span className="site-background-grid" />
            </div>
            {/* No header, anywhere. The operator's call (2026-08-05): the
                lower-left logo trigger is the only navigation, and reclaiming
                the vertical space a header costs is the point of the redesign.
                `AdaptiveSiteHeader` and `MobileBottomNav` are gone from the
                tree rather than hidden by CSS — hidden chrome is still
                focusable and still in the accessibility tree, which is exactly
                the defect that shipped on /app before mmm.css stood it down.

                `AppShell` is gone with them. It was the 82px-header shell that
                the Music/Map/Me redesign replaces; leaving it mounted is the
                "ghost popping through" the operator reported. What remains is
                the plain page wrapper it used to render on non-shell routes, so
                marketing and auth are unchanged apart from the missing header.

                CookieConsent is no longer rendered globally: consent is asked
                during onboarding, once someone actually signs up. It also used
                to sit exactly where the logo fan opens and swallowed every tap
                on the nav at phone width. */}
            <div className="site-shell">
              <main id="main-content">{children}</main>
              <SiteFooter />
            </div>
            <SitePlayerDock />
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
