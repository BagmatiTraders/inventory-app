import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bagmatitraders.app',
  appName: 'Bagmati Traders',
  webDir: 'out',
  server: {
    url: 'https://inventory-app-beta-coral.vercel.app',
    cleartext: true
  },
  backgroundColor: '#00000000',
  plugins: {
    App: {
      // CRITICAL: Let JavaScript handle ALL back button presses
      // This prevents Capacitor from doing default navigation
      // We'll handle it with App.addListener('backButton')
      backButtonMode: 'custom'
    }
  }
};

export default config;
