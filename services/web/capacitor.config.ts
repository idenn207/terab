import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';
import '@capacitor/push-notifications';
import '@capacitor/splash-screen';

type CapacitorEnv = 'bundle' | 'dev' | 'prod';
const env = (process.env.CAPACITOR_ENV ?? 'bundle') as CapacitorEnv;

const servers: Record<CapacitorEnv, CapacitorConfig['server']> = {
  bundle: undefined,
  dev: { url: 'http://10.0.2.2:5173', androidScheme: 'http' },
  prod: { url: 'https://drive.skypark207.com', androidScheme: 'https' },
};

console.log('env: ', env);

const config: CapacitorConfig = {
  appId: 'com.skypark207.drive',
  appName: 'TeraB',
  webDir: 'dist',
  server: servers[env],
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Keyboard: {
      resizeOnFullScreen: true,
      resize: KeyboardResize.Body,
    },
  },
};

export default config;
