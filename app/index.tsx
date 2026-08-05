import { Redirect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { isSupabaseConfigured, getSupabaseConfigHint } from '../lib/supabase';
import { colors } from '../lib/theme';

export default function Index() {
  const { session, loading, initError } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, minHeight: '100vh' as unknown as number }}>
        <ActivityIndicator size="large" color={colors.blue} />
      </View>
    );
  }

  if (initError && !isSupabaseConfigured) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background, minHeight: '100vh' as unknown as number }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.blueDark, marginBottom: 12 }}>
          Configuración incompleta
        </Text>
        <Text style={{ color: colors.text, lineHeight: 22 }}>{getSupabaseConfigHint()}</Text>
      </View>
    );
  }

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/login" />;
}
