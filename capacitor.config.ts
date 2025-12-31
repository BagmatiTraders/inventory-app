import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bagmatitraders.app',
  appName: 'Bagmati Traders',
  webDir: 'out',
  server: {
    url: 'https://inventory-app-beta-coral.vercel.app',
    cleartext: true
  }
};

export default config;
