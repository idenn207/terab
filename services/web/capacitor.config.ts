import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';
import '@capacitor/push-notifications';
import '@capacitor/splash-screen';

const config: CapacitorConfig = {
  appId: 'com.skypark207.drive',
  appName: 'TeraB',
  webDir: 'dist',
  /** 운영 배포 시 주석 해제 */
  // server: {
  //   url: 'https://drive.skypark207.com',
  //   androidScheme: 'https',
  // },
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
