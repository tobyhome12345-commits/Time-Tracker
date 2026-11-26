import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.touchgrass.tracker',
  appName: 'Touch Grass',
  webDir: 'dist',
  android: {
    // Keep WebView content on device only; no remote URLs.
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      style: 'DEFAULT',
    },
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: '#8fd3ff',
      showSpinner: false,
    },
  },
};

export default config;
