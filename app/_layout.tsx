import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../lib/auth';
import { FontProvider } from '../lib/FontProvider';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <FontProvider>
      <AuthProvider>
        <StatusBar style="dark" />
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
      </AuthProvider>
      </FontProvider>
    </SafeAreaProvider>
  );
}
