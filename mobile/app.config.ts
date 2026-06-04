import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'iHYPE',
  slug: 'ihype',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  scheme: 'ihype',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0a0a0a',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.ihype.app',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0a0a0a',
    },
    package: 'com.ihype.app',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
  ],
  extra: {
    // Set API_BASE_URL in your EAS build environment or local .env
    apiBaseUrl: process.env.API_BASE_URL ?? 'https://ihype.org',
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? 'e14117e6-05c3-4987-944a-988ef6c844fa',
    },
  },
};

export default config;
