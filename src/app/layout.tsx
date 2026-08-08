import './globals.css';
import './shell.css';
import './shell-surfaces.css';
// Last, on purpose: the phone-fit floors are minimums that must survive the
// three files above, and source order is what gives an equal-specificity rule
// the win. It touches nothing at `pointer: fine`.
import './mobile-fit.css';
import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';
import { Bricolage_Grotesque, Work_Sans, JetBrains_Mono, Instrument_Serif, Forum, Yeseva_One } from 'next/font/google';
import { AppProviders } from '@/components/AppProviders';
import { AdaptiveSiteHeader } from '@/components/AdaptiveSiteHeader';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { OfflineBanner } from '@/components/OfflineBanner';
import { SitePlayerDock } from '@/components/GlobalMediaPlayer';
import { WebVitals } from '@/components/WebVitals';
import { SiteFooter } from '@/components/SiteFooter';
import { CookieConsent } from '@/components/CookieConsent';
import { AnalyticsBeacon } from '@/components/AnalyticsBeacon';
import { getCspNonce } from '@/lib/csp-nonce';
import { AppSplash } from '@/components/AppSplash';
import { getServerT } from '@/lib/i18n/server';
import { isInviteCodeRequiredRuntime } from '@/lib/runtime-flags';
import { AppShell } from '@/components/shell/AppShell';
import { getShellViewer } from '@/lib/shell-account';

// Design system v8's "Bulletin" direction: Bricolage Grotesque retires Syne on
// display, Work Sans retires DM Sans on body. The CSS variable names are
// deliberately NOT renamed — `--font-syne`/`--font-dm` are referenced by
// --f-d/--f-b in globals.css and by a handful of inline styles, and renaming
// them would be a second, unrelated churn across the same files. The names are
// stale; the values are correct.
//
// Bricolage is a variable font with an optical-size axis, which is the whole
// point of choosing it (ADHERENCE rule 31: set `opsz` to the pixel size AND
// letter-spacing -.035em at headline sizes). `weight` is therefore omitted —
// passing a weight list to next/font pins static instances and throws the axes
// away, taking `opsz` with them.
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], axes: ['opsz'], variable: '--font-syne', display: 'swap' });
const workSans = Work_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-dm', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-jb', display: 'swap' });
const instrumentSerif = Instrument_Serif({ subsets: ['latin'], weight: ['400'], style: ['normal', 'italic'], variable: '--font-serif', display: 'swap' });
const forum = Forum({ subsets: ['latin'], weight: ['400'], variable: '--font-forum', display: 'swap' });
// The nameplate. One weight, display only: it sets the three module labels in
// the arc nav and nothing else — at text sizes its contrast closes up.
const yeseva = Yeseva_One({ subsets: ['latin'], weight: ['400'], variable: '--font-yeseva', display: 'swap' });

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
    <html lang="en" suppressHydrationWarning className={`${bricolage.variable} ${workSans.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable} ${forum.variable} ${yeseva.variable}`}>
      <head>
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeBootstrap }}
        />
      </head>
      <body>
        <AppProviders>
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
            inviteOnly={inviteOnly}
            label={t('layout.primarySiteHeader', 'Primary site header')}
          />
          <MobileBottomNav />
          {/* Off shell routes (marketing and auth) AppShell renders exactly
              what this layout rendered before — site-shell + footer — so
              nothing about the signed-out experience changes. The footer
              crosses as a slot, not a render prop: a function cannot be
              serialized to a client component. */}
          <AppShell account={shellAccount} footer={<SiteFooter />} unreadCount={unreadCount}>
            {children}
          </AppShell>
          <SitePlayerDock />
          <CookieConsent />
          <ServiceWorkerRegister />
        </AppProviders>
        {process.env.NEXT_PUBLIC_CF_BEACON_TOKEN ? (
          <AnalyticsBeacon nonce={nonce} token={process.env.NEXT_PUBLIC_CF_BEACON_TOKEN} />
        ) : null}
      </body>
    </html>
  );
}
