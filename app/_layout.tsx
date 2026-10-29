import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeStatusBar } from '../components/ThemeStatusBar';
import { AuthProvider } from '../lib/auth';
import { FontProvider } from '../lib/FontProvider';
import { ThemeModeProvider } from '../lib/ThemeModeProvider';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <FontProvider>
      <AuthProvider>
        <ThemeModeProvider>
        <ThemeStatusBar />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="registro" />
          <Stack.Screen name="estudios" />
          <Stack.Screen name="day/[date]" />
          <Stack.Screen name="log/[id]" />
          <Stack.Screen name="stock" />
          <Stack.Screen name="dashboard" />
          <Stack.Screen name="care-log" />
        </Stack>
        </ThemeModeProvider>
      </AuthProvider>
      </FontProvider>
    </SafeAreaProvider>
  );
}
