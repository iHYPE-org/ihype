import type { CapacitorConfig } from '@capacitor/cli';

// iHYPE ships as a thin native shell around the live site rather than a
// separate app codebase — server.url points the WebView at production, so
// every web deploy (Cloudflare, ~2 min) reaches iOS/Android immediately with
// no App Store/Play Store review in the loop. Store review only re-enters
// the picture for native-shell changes themselves (icon, splash, a new
// native plugin) — see .github/workflows/native-build.yml.
const config: CapacitorConfig = {
  appId: 'com.ihype.app',
  appName: 'iHYPE',
  webDir: 'capacitor-shell',
  server: {
    url: process.env.CAPACITOR_SERVER_URL || 'https://ihype.org',
    androidScheme: 'https',
    cleartext: false,
    /**
     * WITHOUT THIS, A FAN CANNOT BUY A TICKET IN THE APP (2026-09-04).
     *
     * Capacitor ejects any top-level navigation off `server.url` into the
     * system browser — Android `Bridge.launchIntent()`, iOS
     * `WebViewDelegationHandler` `UIApplication.shared.open` + `.cancel`. The
     * app navigates off-origin for money in SEVEN places: `TicketSaleCard`
     * (checkout), `PayoutConnectButton`, `MmmSettings` ×2, `AdvertisePage`,
     * `CampaignCancelButton` and `ArtistOnboardingWizard` (Connect onboarding).
     * So the buyer landed in Safari, and Stripe's `success_url` is a SERVER
     * redirect, which never triggers a universal link — they did not come back
     * either.
     *
     * ## What this costs, measured rather than assumed
     *
     * On Android `allowNavigation` is not only a navigation allowlist: the same
     * hosts are passed to `WebViewCompat.addWebMessageListener(webView,
     * "androidBridge", …)` in `MessageHandler.java:36`, so a listed origin can
     * reach the NATIVE BRIDGE. The blast radius here is small and was checked
     * before shipping — the only plugins installed are `@capacitor/app` and
     * `@capacitor/push-notifications`, so it is app-state and the push token,
     * not filesystem or camera — and the origins are Stripe's. It is still a
     * real widening, which is why the list is two exact hosts and must never
     * become `*.stripe.com`.
     *
     * ## The reason this is a STOPGAP and (b) is still the right end state
     *
     * A card that triggers 3-D Secure can send the top-level frame to the
     * ISSUING BANK's domain, and the set of bank domains is not enumerable —
     * so an allowlist cannot cover it, and a payment that ejects mid-3DS is a
     * worse failure than one that ejects at the start, because the buyer has
     * already entered card details. Modern Stripe Checkout usually handles 3DS
     * in an iframe on `checkout.stripe.com`, which this covers; "usually" is
     * not a guarantee and nothing here can make it one.
     *
     * The end state is `@capacitor/browser` — an in-app Custom Tab /
     * SFSafariViewController, which needs no allowlist at all because it is
     * not the app's WebView, grants no bridge access, and follows a redirect
     * chain to any bank. It is not shipped here because the RETURN leg needs
     * real work (a server redirect does not open the app; it wants an
     * app-resume listener that re-reads order state). Ship that before the
     * first real sale.
     */
    allowNavigation: ['checkout.stripe.com', 'connect.stripe.com'],
  },
  // The ground behind the WebView. This is the one colour in the product that
  // no stylesheet can reach, which is why it was still the RETIRED warm
  // near-black (#0a0805) after Design System 8 moved the ground to ink navy —
  // visible as a launch flash and on overscroll, on both platforms. Changing it
  // needs a native build, not a web deploy.
  //
  // AND IT WENT STALE AGAIN, ONE GENERATION LATER (2026-09-03). The comment
  // above was written about #0a0805; the value it was corrected TO — DS8's ink
  // navy #0b1220 — was itself retired on 2026-08-19/20 when the console
  // conversion moved the ground to warm cream. So both native apps have been
  // flashing dark navy at launch and showing it behind every overscroll bounce
  // on a cream app.
  //
  // It rots for a structural reason worth naming: it is the only colour
  // OUTSIDE the fast loop. Every other surface follows --bg on the next
  // Cloudflare deploy; this one waits for a native build, so a ground change
  // silently leaves it behind. It must match --bg in globals.css, and
  // `themeColor` in src/app/layout.tsx (already #f0dfb8) is the same value —
  // when one moves, all three move.
  //
  // One value, six themes: cream is the DEFAULT ground and the config cannot
  // theme, so a dark-theme member still gets a cream flash. That is the right
  // trade — it is a fraction of a second against the majority case being
  // correct — and it is a limit of the native shell, not a decision to revisit.
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#f0dfb8',
  },
  android: {
    backgroundColor: '#f0dfb8',
  },
  plugins: {
    // Shows the OS notification banner/sound/badge while the app is already
    // open — without this, iOS silently drops foreground pushes. Takes
    // effect as soon as push notifications work at all; no credentials
    // needed for this config itself.
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
