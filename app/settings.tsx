import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Redirect } from 'expo-router';
import { BackButton } from '../components/BackButton';
import { useAuth } from '../lib/auth';
import {
  createProfileInvite,
  deactivateProfile,
  deleteProfileInvite,
  fetchManagedProfiles,
  fetchPendingInvites,
  type AppProfile,
  type ProfileInvite,
} from '../lib/profiles';
import { Screen } from '../lib/screen';
import { colors } from '../lib/theme';
import { fonts } from '../lib/typography';

export default function SettingsScreen() {
  const { session, role } = useAuth();
  const [profiles, setProfiles] = useState<AppProfile[]>([]);
  const [invites, setInvites] = useState<ProfileInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newNombre, setNewNombre] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, i] = await Promise.all([fetchManagedProfiles(), fetchPendingInvites()]);
      setProfiles(p.filter((x) => x.activo));
      setInvites(i);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session && role === 'organizador') void load();
  }, [session, role, load]);

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (role !== 'organizador') {
    return <Redirect href="/(tabs)" />;
  }

  const handleAdd = async () => {
    if (!newEmail.trim() || !newNombre.trim()) {
      Alert.alert('Perfiles', 'Indicá correo y nombre');
      return;
    }
    setSaving(true);
    try {
      await createProfileInvite(newEmail, newNombre, session.user.id);
      setNewEmail('');
      setNewNombre('');
      await load();
      Alert.alert(
        'Invitación creada',
        'La persona debe ir a «Crear cuenta» con ese correo y elegir su contraseña.'
      );
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : '';
      Alert.alert('Error', msg || 'No se pudo agregar el perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = (p: AppProfile) => {
    if (p.id === session.user.id) {
      Alert.alert('Perfiles', 'No podés desactivar tu propio usuario');
      return;
    }
    if (p.role === 'organizador') {
      Alert.alert('Perfiles', 'No podés desactivar otro administrador desde aquí');
      return;
    }
    Alert.alert('Desactivar perfil', `¿Desactivar a ${p.nombre_completo}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desactivar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deactivateProfile(p.id);
            await load();
          } catch {
            Alert.alert('Error', 'No se pudo desactivar');
          }
        },
      },
    ]);
  };

  const handleDeleteInvite = (inv: ProfileInvite) => {
    Alert.alert('Quitar invitación', `¿Eliminar invitación de ${inv.email}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProfileInvite(inv.id);
            await load();
          } catch {
            Alert.alert('Error', 'No se pudo eliminar');
          }
        },
      },
    ]);
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <BackButton />
          <Text style={styles.title}>Settings</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.sectionTitle}>Perfiles</Text>
        <Text style={styles.hint}>
          Agregá correo y nombre. La persona completa su contraseña en «Crear cuenta».
        </Text>

        <Text style={styles.label}>Correo</Text>
        <TextInput
          style={styles.input}
          value={newEmail}
          onChangeText={setNewEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="correo@ejemplo.com"
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.label}>Nombre del perfil</Text>
        <TextInput
          style={styles.input}
          value={newNombre}
          onChangeText={setNewNombre}
          placeholder="Nombre visible en registros"
          placeholderTextColor={colors.textMuted}
        />
        <Pressable style={styles.addBtn} onPress={handleAdd} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.addBtnText}>Agregar perfil</Text>
          )}
        </Pressable>

        {loading ? (
          <ActivityIndicator color={colors.pinkDeep} style={{ marginTop: 24 }} />
        ) : (
          <>
            {invites.length > 0 && (
              <>
                <Text style={styles.subSection}>Invitaciones pendientes</Text>
                {invites.map((inv) => (
                  <View key={inv.id} style={styles.row}>
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle}>{inv.nombre_completo}</Text>
                      <Text style={styles.rowSub}>{inv.email}</Text>
                    </View>
                    <Pressable onPress={() => handleDeleteInvite(inv)} hitSlop={8}>
                      <Text style={styles.deleteText}>Quitar</Text>
                    </Pressable>
                  </View>
                ))}
              </>
            )}

            <Text style={styles.subSection}>Perfiles activos</Text>
            {profiles.map((p) => (
              <View key={p.id} style={styles.row}>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{p.nombre_completo}</Text>
                  <Text style={styles.rowSub}>
                    {p.email ?? '—'} · {p.role === 'organizador' ? 'Administradora' : 'Equipo'}
                  </Text>
                </View>
                {p.role === 'enfermera' && p.activo ? (
                  <Pressable onPress={() => handleDeactivate(p)} hitSlop={8}>
                    <Text style={styles.deleteText}>Borrar</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.titleExtra, fontSize: 22, color: colors.text },
  headerSpacer: { width: 40 },
  sectionTitle: { fontFamily: fonts.title, fontSize: 18, color: colors.text, marginTop: 8 },
  subSection: { fontFamily: fonts.title, fontSize: 16, color: colors.text, marginTop: 20, marginBottom: 8 },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 6, marginBottom: 12, lineHeight: 18 },
  label: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text, marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 2,
    borderColor: colors.borderSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.card,
  },
  addBtn: {
    marginTop: 12,
    backgroundColor: colors.pinkDeep,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addBtnText: { fontFamily: fonts.bodySemi, color: colors.white, fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  rowBody: { flex: 1 },
  rowTitle: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  rowSub: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  deleteText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.error },
});
