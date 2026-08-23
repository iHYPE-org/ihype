import './globals.css';
import './mmm-workflows.css';
import './mmm-primitives.css';
import './mmm-console.css';
// Last, on purpose: the phone-fit floors are minimums that must survive the
// three files above, and source order is what gives an equal-specificity rule
// the win. It touches nothing at `pointer: fine`.
import './mobile-fit.css';
import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';
import localFont from 'next/font/local';
import { AppProviders } from '@/components/AppProviders';
import { AdaptiveSiteHeader } from '@/components/AdaptiveSiteHeader';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { SiteTabBar } from '@/components/SiteTabBar';
import { OfflineBanner } from '@/components/OfflineBanner';
import { SitePlayerDock } from '@/components/GlobalMediaPlayer';
import { WebVitals } from '@/components/WebVitals';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { CookieConsent } from '@/components/CookieConsent';
import { AnalyticsBeacon } from '@/components/AnalyticsBeacon';
import { getCspNonce } from '@/lib/csp-nonce';
import { AppSplash } from '@/components/AppSplash';
import { getServerT } from '@/lib/i18n/server';
import { isInviteCodeRequiredRuntime } from '@/lib/runtime-flags';

/**
 * Design System 8 ("Bulletin") type, served from files IN THIS REPO.
 *
 * ## Why these are vendored rather than `next/font/google`
 *
 * `next/font/google` fetches every face from `fonts.gstatic.com` AT BUILD
 * TIME — three retries, then a hard `Failed to fetch ... from Google Fonts`
 * that fails the whole build. That is not only a PR nuisance:
 * `deploy-production.yml` re-runs the same Cloudflare build before it ships,
 * so an outage at Google blocked RELEASES. It did exactly that on 2026-08-13.
 *
 * Vendoring removes a third party from the build path entirely. The files are
 * the same ones Google serves — latin subset, matching the `subsets: ['latin']`
 * this used to request — refreshed by `npm run fonts:fetch`
 * (`scripts/fetch-fonts.mjs`), which is a deliberate manual step: a script that
 * ran during the build would put the network dependency straight back.
 *
 * ## Why three of the four are VARIABLE faces
 *
 * Bricolage has to be: `font-variation-settings: 'opsz' N` on the display ramp
 * is why the handoff chose the family, and a static instance has no axis to
 * set. That was already true before this change.
 *
 * Work Sans and JetBrains Mono did not have to be, and are anyway because it
 * is strictly smaller. Their latin variable faces are 49 KB and 39 KB and
 * carry every weight; the four and three STATIC weights they replace were
 * 196 KB and 92 KB. Same designs at 400/500/600/700 — these are the named
 * instances of the same masters — for 200 KB less, for every visitor.
 *
 * Instrument Serif ships no variable face, so it stays two static files.
 *
 * `adjustFontFallback` is left at its default so Next still synthesises
 * fallback metrics and the CLS behaviour does not regress with the move.
 */
const bricolage = localFont({
  src: './fonts/BricolageGrotesque-Variable.woff2',
  // The full wght range the axis carries. Declaring a range rather than a
  // single value is what lets the browser interpolate instead of synthesising.
  weight: '200 800',
  style: 'normal',
  variable: '--font-bricolage',
  display: 'swap',
});
const workSans = localFont({
  src: './fonts/WorkSans-Variable.woff2',
  weight: '100 900',
  style: 'normal',
  variable: '--font-work',
  display: 'swap',
});
const jetbrainsMono = localFont({
  src: './fonts/JetBrainsMono-Variable.woff2',
  weight: '100 800',
  style: 'normal',
  variable: '--font-jb',
  display: 'swap',
});
const instrumentSerif = localFont({
  src: [
    { path: './fonts/InstrumentSerif-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/InstrumentSerif-400italic.woff2', weight: '400', style: 'italic' },
  ],
  variable: '--font-serif',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
});

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
  /**
   * The manifest was never linked. `public/manifest.json` has existed for
   * months, the service worker pre-caches it, and CI fetches it — but nothing
   * ever DECLARED it, so no browser read it: not installable, and its name,
   * icons and shortcuts never applied anywhere. The SW fetching a file is not
   * the same as the document pointing at it.
   */
  manifest: '/manifest.json',
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
  /**
   * One value, because there is one ground. `viewportFit: 'cover'` plus a
   * translucent status bar means the OS paints its own chrome behind the page
   * and needs to know what colour it is sitting on — and the answer no longer
   * depends on the reader's OS preference. This is `--bg`, the cream board.
   *
   * Leaving the old pair here would have been the quiet half of this change:
   * an OS-dark phone would have painted a navy notch above a cream page.
   */
  themeColor: '#f0dfb8',
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
  // Applied before first paint, in <head>, for the same reason the theme is.
  //
  // There is no theme line here any more, and its absence is the point. The
  // product has ONE ground — the cream board — so there is nothing to restore
  // before first paint and no stored choice to read. `html.high-contrast` is
  // still applied below; it is an accessibility mode, not a theme.
  //
  // Text size, high contrast and reduce motion all used to be applied by
  // AccessibilityProvider's useEffect, which runs AFTER hydration — so every
  // cold launch painted the app at 100% and then jumped. On the web that reads
  // as a flicker; inside the Capacitor WebView, where a cold launch is the
  // normal way in, it is the first thing a reader who needs 140% sees, every
  // single time. A preference that only arrives after the page is drawn is not
  // really applied.
  //
  // The OS half is here too, and it is the only mechanism that reaches iOS.
  // Android's WebView scales web text with the system font-size setting on its
  // own; WKWebView does not — Dynamic Type simply does not reach CSS, so a
  // reader who had already enlarged text system-wide got nothing from us and
  // had no reason to suspect a second, in-app control existed. `-apple-system-
  // body` is the one thing that does carry the setting into the page: it is a
  // WebKit system-font keyword whose computed size tracks Dynamic Type, and
  // 17px is its value at the default ("Large") setting, so the ratio is the
  // reader's own enlargement.
  //
  // Three guards, each load-bearing. CSS.supports gates it to engines that
  // actually parse the keyword — elsewhere it silently computes to the
  // inherited 16px and a naive ratio would SHRINK the whole app by 6%. The
  // Math.max(1, …) makes it a floor and never a shrink, which also disposes of
  // desktop Safari, where the same keyword computes to 13px and means nothing
  // about anyone's preference. The cap lives in CSS with the multiply.
  const accessibilityBootstrap = `(function(){var d=document.documentElement;try{var s=JSON.parse(localStorage.getItem('ihype-accessibility-settings')||'{}');var n=Number(s.textScale);if(isFinite(n))d.style.setProperty('--ihype-text-scale',String(Math.min(1.4,Math.max(0.85,n))));if(s.highContrast)d.classList.add('high-contrast');if(s.largeText)d.classList.add('a11y-large-text');if(s.reduceMotion)d.classList.add('a11y-reduce-motion');if(s.underlineLinks)d.classList.add('a11y-underline-links');if(s.readableFont)d.classList.add('a11y-readable-font')}catch(e){}
try{if(window.CSS&&CSS.supports('font','-apple-system-body')){var p=document.createElement('div');p.style.cssText='font:-apple-system-body;position:absolute;top:-9999px;visibility:hidden';d.appendChild(p);var px=parseFloat(getComputedStyle(p).fontSize);p.remove();if(px>0)d.style.setProperty('--ihype-os-text-scale',String(Math.max(1,px/17)))}}catch(e){}})();`;
  return (
    <html lang="en" suppressHydrationWarning className={`${bricolage.variable} ${workSans.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable}`}>
      <head>
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: accessibilityBootstrap }}
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
          {/* Public-site navigation. The /app layout supplies MMM's own
              persistent chrome and locks this header while it is active. */}
          <AdaptiveSiteHeader
            inviteOnly={inviteOnly}
            label={t('layout.primarySiteHeader', 'Primary site header')}
          />
          <SiteTabBar />
          {/* Music · Map · Me owns its persistent chrome in /app/layout.tsx.
              Every route outside /app is now marketing, auth, admin, or a
              redirect-only compatibility route: none may render another
              signed-in shell. */}
          <div className="site-shell">
            <main id="main-content">{children}</main>
          </div>
          <SitePlayerDock />
          {/* Above every shell, on every route: an operator must never be
              able to forget whose account they are looking at. */}
          <ImpersonationBanner />
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
