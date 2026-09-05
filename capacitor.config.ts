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
     * NO `allowNavigation`, DELIBERATELY — and it was here for six hours.
     *
     * Capacitor ejects any top-level navigation off `server.url` into the
     * system browser, so the seven places this app sends a member to Stripe
     * (ticket checkout, ad checkout, ad cancellation, four Connect onboarding
     * buttons) threw them into Safari and never brought them back — Stripe's
     * `success_url` is a SERVER redirect, and those do not open an app.
     *
     * `allowNavigation: ['checkout.stripe.com', 'connect.stripe.com']` fixed
     * that in one line and was shipped first. It is now removed, because
     * `src/lib/open-external.ts` opens those URLs in an in-app browser tab
     * instead, and the allowlist would keep two costs for no remaining
     * benefit:
     *
     *   1. On Android the listed hosts are handed to
     *      `WebViewCompat.addWebMessageListener(webView, "androidBridge", …)`
     *      (`MessageHandler.java:36`), so an allowlisted origin can reach the
     *      NATIVE BRIDGE. Small here — only `@capacitor/app` and
     *      `@capacitor/push-notifications` are installed — but real.
     *   2. It cannot cover 3-D Secure. A card challenge can send the top-level
     *      frame to the ISSUING BANK's domain, and bank domains are not
     *      enumerable. Ejecting mid-3DS is worse than ejecting at the start.
     *
     * A Custom Tab / `SFSafariViewController` is not the app's WebView: no
     * allowlist, no bridge, any redirect chain, and it shows the real URL and
     * padlock, which a WebView cannot. **Do not re-add this key** — if a money
     * flow ejects, the fix is to route it through `openExternalUrl`, and
     * `wiring-guards.test.ts` fails the build on a `window.location` to a
     * checkout or onboarding URL.
     */
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
  // `themeColor` in src/app/layout.tsx (already #ffffff) is the same value —
  // when one moves, all three move.
  //
  // One value, six themes: cream is the DEFAULT ground and the config cannot
  // theme, so a dark-theme member still gets a cream flash. That is the right
  // trade — it is a fraction of a second against the majority case being
  // correct — and it is a limit of the native shell, not a decision to revisit.
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#ffffff',
  },
  android: {
    backgroundColor: '#ffffff',
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
