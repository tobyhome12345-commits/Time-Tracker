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
      backgroundColor: '#16a34a',
      showSpinner: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_pip',
      iconColor: '#16a34a',
    },
  },
};

export default config;
