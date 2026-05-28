import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.insurerank.app',
  appName: 'InsureRank',
  webDir: 'out',
  // In native builds the web app loads from the production server, not a local bundle.
  // This keeps all business logic and API calls going through the same Next.js backend.
  server: {
    url: process.env.CAPACITOR_SERVER_URL ?? 'https://app.insurerank.com',
    cleartext: false,
  },
  ios: {
    scheme: 'App',
    contentInset: 'automatic',
    scrollEnabled: false,
    // Allow the WKWebView to use camera/microphone for WebRTC
    allowsLinkPreview: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
}

export default config
