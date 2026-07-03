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
};

export default config;
