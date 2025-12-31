import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bagmatitraders.app',
  appName: 'Bagmati Traders',
  webDir: 'out',
  server: {
    url: 'https://bagmati-inventory.vercel.app',
    cleartext: true
  }
};

export default config;
