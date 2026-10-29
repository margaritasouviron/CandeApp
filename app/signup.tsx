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
import { Link, Redirect, useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import { canRegisterEmail } from '../lib/profiles';
import { Screen } from '../lib/screen';
import { colors } from '../lib/theme';
import { fonts } from '../lib/typography';

export default function SignupScreen() {
  const { session, signUp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  const handleSignup = async () => {
    setError('');
    if (!email.trim() || !nombre.trim() || !password) {
      setError('Completá correo, nombre y contraseña');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    setLoading(true);
    try {
      const allowed = await canRegisterEmail(email);
      if (!allowed) {
        setError('Este correo no tiene invitación. Pedí acceso a la administradora.');
        return;
      }
      const err = await signUp(email, password, nombre);
      if (err) {
        setError(err);
        return;
      }
      router.replace('/(tabs)');
    } catch {
      setError('No se pudo crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.title}>Crear cuenta</Text>
            <Text style={styles.subtitle}>Usá el correo que te dio la administradora</Text>

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

            <Text style={styles.label}>Tu nombre</Text>
            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={setNombre}
              placeholder="Nombre y apellido"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Mínimo 8 caracteres"
              placeholderTextColor={colors.textMuted}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable style={styles.button} onPress={handleSignup} disabled={loading}>
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Registrarme</Text>
              )}
            </Pressable>

            <Link href="/login" asChild>
              <Pressable style={styles.linkWrap}>
                <Text style={styles.link}>Ya tengo cuenta → Iniciar sesión</Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontFamily: fonts.titleExtra, fontSize: 26, color: colors.text, textAlign: 'center' },
  subtitle: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 8, marginBottom: 20 },
  label: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text, marginBottom: 6 },
  input: {
    borderWidth: 2,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    marginBottom: 14,
    backgroundColor: colors.white,
  },
  error: { color: colors.error, textAlign: 'center', marginBottom: 12, fontFamily: fonts.body },
  button: {
    backgroundColor: colors.pinkDeep,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: colors.white, fontFamily: fonts.bodySemi, fontSize: 16 },
  linkWrap: { marginTop: 16, alignItems: 'center' },
  link: { fontFamily: fonts.bodySemi, color: colors.pinkDeep, fontSize: 14 },
});
