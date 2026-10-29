import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link, Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';
import { Screen } from '../lib/screen';
import { isSupabaseConfigured, getSupabaseConfigHint, getSupabaseConfigStatus } from '../lib/supabase';
import { colors } from '../lib/theme';

export default function LoginScreen() {
  const { session, signIn, initError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  const handleLogin = async () => {
    setError('');
    if (!email || !password) {
      setError('Introduce correo y contraseña');
      return;
    }
    setLoading(true);
    const err = await signIn(email, password);
    setLoading(false);
    if (err) setError(err);
  };

  const configStatus = getSupabaseConfigStatus();

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.card}>
        <Text style={styles.title}>candeApp</Text>
        <Text style={styles.subtitle}>Gestión de cuidados en el hogar</Text>

        {initError ? (
          <View style={styles.warning}>
            <Text style={styles.warningText}>{initError}</Text>
          </View>
        ) : null}

        {!isSupabaseConfigured && (
          <View style={styles.warning}>
            <Text style={styles.warningText}>{getSupabaseConfigHint()}</Text>
            <Text style={styles.warningSub}>
              URL: {configStatus.urlPreview}{'\n'}
              Key: {configStatus.keyLength > 0 ? `${configStatus.keyLength} caracteres` : 'vacía'}
            </Text>
          </View>
        )}

        <Text style={styles.label}>Correo electrónico</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="correo@ejemplo.com"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor={colors.textMuted}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Iniciar sesión</Text>
          )}
        </Pressable>

        <Link href="/signup" asChild>
          <Pressable style={styles.linkWrap}>
            <Text style={styles.link}>Primera vez → Crear cuenta</Text>
          </Pressable>
        </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.blueDark,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  warning: {
    backgroundColor: colors.brownLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  warningText: {
    color: colors.brown,
    fontSize: 13,
  },
  warningSub: {
    color: colors.brown,
    fontSize: 12,
    marginTop: 8,
    opacity: 0.85,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    marginBottom: 16,
    backgroundColor: colors.white,
  },
  error: {
    color: colors.error,
    textAlign: 'center',
    marginBottom: 12,
  },
  button: {
    backgroundColor: colors.blue,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  linkWrap: { marginTop: 16, alignItems: 'center' },
  link: { fontSize: 14, fontWeight: '600', color: colors.pinkDeep },
});
