import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.spinchain.app',
  appName: 'SpinChain',
  webDir: '.next',
  server: {
    androidScheme: 'https'
  }
};

export default config;
