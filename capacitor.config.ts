import { CapacitorConfig } from '@capacitor/cli';

const remoteServerUrl = process.env.CAPACITOR_SERVER_URL;
const useRemoteServer = Boolean(remoteServerUrl);

const config: CapacitorConfig = {
  appId: 'com.spinchain.app',
  appName: 'SpinChain',
  webDir: 'out',
  server: useRemoteServer
    ? {
        url: remoteServerUrl,
        cleartext: remoteServerUrl?.startsWith('http://') ?? false,
        androidScheme: remoteServerUrl?.startsWith('http://') ? 'http' : 'https',
      }
    : {
        androidScheme: 'https',
      },
};

export default config;
