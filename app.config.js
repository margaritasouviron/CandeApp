/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    name: 'Cande App',
    slug: 'candeApp',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'candeapp',
    userInterfaceStyle: 'light',
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.anonymous.candeApp',
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#FFFBF7',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
    },
    web: {
      bundler: 'metro',
      output: 'single',
      favicon: './assets/images/favicon.png',
      name: 'Cande App',
      shortName: 'Cande',
      description: 'Gestión de cuidados en el hogar',
      themeColor: '#FFBACF',
      backgroundColor: '#FFFBF7',
      display: 'standalone',
      orientation: 'portrait',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          resizeMode: 'contain',
          backgroundColor: '#FFFBF7',
        },
      ],
    ],
    extra: {
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
  },
};
