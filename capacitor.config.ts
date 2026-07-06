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
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0a0805',
  },
  android: {
    backgroundColor: '#0a0805',
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
