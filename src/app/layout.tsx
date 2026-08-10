import './globals.css';
import './shell.css';
import './shell-surfaces.css';
// Last, on purpose: the phone-fit floors are minimums that must survive the
// three files above, and source order is what gives an equal-specificity rule
// the win. It touches nothing at `pointer: fine`.
import './mobile-fit.css';
import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';
import { Bricolage_Grotesque, Work_Sans, JetBrains_Mono, Instrument_Serif, Forum } from 'next/font/google';
import { AppProviders } from '@/components/AppProviders';
import { AdaptiveSiteHeader } from '@/components/AdaptiveSiteHeader';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { OfflineBanner } from '@/components/OfflineBanner';
import { SitePlayerDock } from '@/components/GlobalMediaPlayer';
import { WebVitals } from '@/components/WebVitals';
import { SiteFooter } from '@/components/SiteFooter';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { CookieConsent } from '@/components/CookieConsent';
import { AnalyticsBeacon } from '@/components/AnalyticsBeacon';
import { getCspNonce } from '@/lib/csp-nonce';
import { MobileShellProvider } from '@/lib/MobileShellContext';
import { MobileAppShellLoader } from '@/components/MobileAppShellLoader';
import { AppSplash } from '@/components/AppSplash';
import { getServerT } from '@/lib/i18n/server';
import { isInviteCodeRequiredRuntime } from '@/lib/runtime-flags';
import { AppShell } from '@/components/shell/AppShell';
import { getShellViewer } from '@/lib/shell-account';

// Design System 8 ("Bulletin"): Bricolage Grotesque retires Syne on display,
// Work Sans retires DM Sans on body. Bricolage is loaded as the VARIABLE face
// with its optical-size axis kept — `axes: ['opsz']` is what makes
// `font-variation-settings: 'opsz' N` on the display ramp do anything. Pinning
// a static instance instead would throw the axis away, which is the reason the
// handoff picked this family. `weight` is deliberately omitted so the whole
// 200..800 wght range ships; next/font rejects the two together on a variable
// face. Work Sans takes fixed weights because only four are ever used.
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], axes: ['opsz'], variable: '--font-bricolage', display: 'swap' });
const workSans = Work_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-work', display: 'swap' });
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
  // Drives the header join CTA's "Join Beta" vs "Join free" copy. Read here
  // rather than in HeaderAuthLinks because that is a client component and this
  // flag lives in KV. One extra KV read per render, alongside the nonce and
  // dictionary reads this layout already does.
  const inviteOnly = await isInviteCodeRequiredRuntime();
  // The signed-in app shell's chrome renders here, in the ROOT layout, because
  // the handoff's first chrome-contract rule is that the top bar and the player
  // never re-render on navigation — only the content region may be replaced.
  // A layout is the only place in the App Router that guarantees that.
  const { account: shellAccount, unreadCount } = await getShellViewer();
  const themeBootstrap = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.setAttribute('data-theme',t)}catch(e){}})();`;
  return (
    <html lang="en" suppressHydrationWarning className={`${bricolage.variable} ${workSans.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable} ${forum.variable}`}>
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
            {/* Marketing nav. On shell routes the signed-in app shell replaces
                it outright — hidden by `html.ihype-shell-locked` in shell.css.
                (The old comment here named `.wb-shell`, a class that no longer
                exists anywhere in the codebase.) */}
            <AdaptiveSiteHeader
              account={shellAccount}
              inviteOnly={inviteOnly}
              label={t('layout.primarySiteHeader', 'Primary site header')}
            />
            <MobileBottomNav />
            <MobileAppShellLoader />
            {/* Off shell routes (marketing, auth, and the phone swipe shell)
                AppShell renders exactly what this layout rendered before —
                site-shell + footer — so nothing about the signed-out
                experience changes. The footer crosses as a slot, not a render
                prop: a function cannot be serialized to a client component. */}
            <AppShell account={shellAccount} footer={<SiteFooter />} unreadCount={unreadCount}>
              {children}
            </AppShell>
            <SitePlayerDock />
            {/* Above every shell, on every route: an operator must never be
                able to forget whose account they are looking at. */}
            <ImpersonationBanner />
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
