import { StatusBar } from 'expo-status-bar';
import { useThemeMode } from '../lib/ThemeModeProvider';

export function ThemeStatusBar() {
  const { isSleeping } = useThemeMode();
  return <StatusBar style={isSleeping ? 'light' : 'dark'} />;
}
