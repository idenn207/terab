import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.skypark207.drive',
  appName: 'NAS Drive',
  webDir: 'dist',
  /** Live 환경에서 사용 */
  // server: {
  //   url: 'https://drive.skypark207.com',
  //   androidScheme: 'https',
  // },
};

export default config;
