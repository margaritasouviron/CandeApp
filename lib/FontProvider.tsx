import { useFonts } from 'expo-font';
import {
  Raleway_400Regular,
  Raleway_600SemiBold,
} from '@expo-google-fonts/raleway';
import {
  Outfit_700Bold,
  Outfit_800ExtraBold,
} from '@expo-google-fonts/outfit';
import { ActivityIndicator, View } from 'react-native';
import { colors } from './theme';

export function FontProvider({ children }: { children: React.ReactNode }) {
  const [loaded] = useFonts({
    Raleway_400Regular,
    Raleway_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
  });

  if (!loaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.greenDark} />
      </View>
    );
  }

  return children;
}
