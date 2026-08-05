import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { addPurchase, createInventoryItem, fetchInventory, type InventoryItem } from '../../lib/inventory';
import { getPatient } from '../../lib/patientContext';
import { Screen } from '../../lib/screen';
import { colors } from '../../lib/theme';

const NEW_ITEM = '__new__';

export default function AddPurchaseScreen() {
  const { session, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>(NEW_ITEM);
  const [nombre, setNombre] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [unidad, setUnidad] = useState('unidad');
  const [minima, setMinima] = useState('5');
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isOrganizador = role === 'organizador';
  const isNew = selectedId === NEW_ITEM;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const patient = await getPatient();
      if (!patient) return;
      const list = await fetchInventory(patient.id);
      setItems(list);
      if (list.length > 0) {
        setSelectedId((prev) => (prev === NEW_ITEM ? list[0].id : prev));
        setUnidad(list[0].unidad);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  if (authLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.blue} style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  if (!session) return <Redirect href="/login" />;

  const handleSave = async () => {
    const qty = parseFloat(cantidad.replace(',', '.'));
    if (!Number.isFinite(qty) || qty <= 0) {
      Alert.alert('Error', 'Indica una cantidad válida');
      return;
    }

    setSaving(true);
    try {
      const patient = await getPatient();
      if (!patient) {
        Alert.alert('Error', 'No hay paciente configurado');
        return;
      }

      let itemId = selectedId;

      if (isNew) {
        if (!isOrganizador) {
          Alert.alert('Error', 'Solo la administradora puede crear ítems nuevos');
          return;
        }
        if (!nombre.trim()) {
          Alert.alert('Error', 'Indica el nombre del ítem');
          return;
        }
        const min = parseFloat(minima.replace(',', '.'));
        itemId = await createInventoryItem({
          patientId: patient.id,
          nombre: nombre.trim(),
          cantidad: 0,
          minima: Number.isFinite(min) ? min : 0,
          unidad: unidad.trim() || 'unidad',
        });
      }

      await addPurchase({
        itemId,
        cantidad: qty,
        unidad: unidad.trim() || 'unidad',
        fechaCompra: new Date().toISOString().slice(0, 10),
        notas,
        userId: session.user.id,
      });

      Alert.alert('Listo', 'Compra registrada', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Volver</Text>
        </Pressable>
        <Text style={styles.title}>Agregar compra</Text>

        {loading ? (
          <ActivityIndicator color={colors.blue} style={{ marginTop: 24 }} />
        ) : (
          <>
            <Text style={styles.label}>Tipo / ítem</Text>
            <View style={styles.chips}>
              {items.map((item) => (
                <Pressable
                  key={item.id}
                  style={[styles.chip, selectedId === item.id && styles.chipOn]}
                  onPress={() => {
                    setSelectedId(item.id);
                    setUnidad(item.unidad);
                  }}
                >
                  <Text style={[styles.chipText, selectedId === item.id && styles.chipTextOn]}>{item.nombre}</Text>
                </Pressable>
              ))}
              {isOrganizador && (
                <Pressable
                  style={[styles.chip, isNew && styles.chipOn]}
                  onPress={() => setSelectedId(NEW_ITEM)}
                >
                  <Text style={[styles.chipText, isNew && styles.chipTextOn]}>+ Nuevo</Text>
                </Pressable>
              )}
            </View>

            {isNew && (
              <>
                <Text style={styles.label}>Nombre</Text>
                <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Ej. Pañales" placeholderTextColor={colors.textMuted} />
                <Text style={styles.label}>Stock mínimo (alerta)</Text>
                <TextInput style={styles.input} value={minima} onChangeText={setMinima} keyboardType="decimal-pad" placeholderTextColor={colors.textMuted} />
              </>
            )}

            <Text style={styles.label}>Cantidad</Text>
            <TextInput style={styles.input} value={cantidad} onChangeText={setCantidad} keyboardType="decimal-pad" placeholder="Ej. 30" placeholderTextColor={colors.textMuted} />

            <Text style={styles.label}>Unidad de medida</Text>
            <TextInput style={styles.input} value={unidad} onChangeText={setUnidad} placeholder="unidad, mg, ml…" placeholderTextColor={colors.textMuted} />

            <Text style={styles.label}>Notas (opcional)</Text>
            <TextInput style={styles.input} value={notas} onChangeText={setNotas} placeholderTextColor={colors.textMuted} />

            <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Listo</Text>}
            </Pressable>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: Platform.OS === 'web' ? 32 : 40 },
  back: { marginBottom: 8 },
  backText: { color: colors.blue, fontWeight: '600', fontSize: 16 },
  title: { fontSize: 24, fontWeight: '700', color: colors.blueDark, marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8, marginTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.brownLight },
  chipOn: { backgroundColor: colors.blue },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.brown },
  chipTextOn: { color: colors.white },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.white,
  },
  saveBtn: {
    backgroundColor: colors.blue,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '600' },
});
