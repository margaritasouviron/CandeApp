import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import {
  addPurchase,
  createInventoryItem,
  fetchInventory,
  findInventoryItemByName,
  findPrescriptionByName,
  type InventoryItem,
} from '../../lib/inventory';
import { getPatient } from '../../lib/patientContext';
import { BackButton } from '../../components/BackButton';
import { Screen } from '../../lib/screen';
import { colors } from '../../lib/theme';
import { fonts } from '../../lib/typography';

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
  const [consumoMensual, setConsumoMensual] = useState('');
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    setErrorMsg(null);
    const qty = parseFloat(cantidad.replace(',', '.'));
    if (!Number.isFinite(qty) || qty <= 0) {
      setErrorMsg('Indica una cantidad válida');
      return;
    }

    setSaving(true);
    try {
      const patient = await getPatient();
      if (!patient) {
        setErrorMsg('No hay paciente configurado');
        return;
      }

      let itemId = selectedId;
      let itemName = items.find((i) => i.id === selectedId)?.nombre ?? nombre.trim();

      if (isNew) {
        if (!isOrganizador) {
          setErrorMsg('Solo la administradora puede crear ítems nuevos');
          return;
        }
        if (!nombre.trim()) {
          setErrorMsg('Indica el nombre del ítem');
          return;
        }
        const trimmedName = nombre.trim();
        const min = parseFloat(minima.replace(',', '.'));
        const consumo = parseFloat(consumoMensual.replace(',', '.'));
        const prescriptionId = await findPrescriptionByName(patient.id, trimmedName);
        const existingItem = await findInventoryItemByName(patient.id, trimmedName);
        if (existingItem) {
          itemId = existingItem.id;
          itemName = existingItem.nombre;
        } else {
          itemId = await createInventoryItem({
            patientId: patient.id,
            nombre: trimmedName,
            cantidad: 0,
            minima: Number.isFinite(min) ? min : 0,
            consumoMensual: Number.isFinite(consumo) ? consumo : 0,
            unidad: unidad.trim() || 'unidad',
            prescriptionId,
          });
          itemName = trimmedName;
        }
      }

      if (!itemId || itemId === NEW_ITEM) {
        setErrorMsg('Selecciona un ítem');
        return;
      }

      await addPurchase({
        itemId,
        cantidad: qty,
        unidad: unidad.trim() || 'unidad',
        fechaCompra: new Date().toISOString().slice(0, 10),
        notas,
        userId: session.user.id,
      });

      router.replace({
        pathname: '/(tabs)/stock',
        params: {
          saved: '1',
          message: `Compra registrada: ${qty} ${unidad.trim() || 'unidad'} de ${itemName}`,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo guardar';
      if (msg.includes('inventory') || msg.includes('does not exist')) {
        setErrorMsg('Falta aplicar las migraciones de inventario (008 y 010) en Supabase.');
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <BackButton />
        <Text style={styles.title}>Agregar compra</Text>

        {errorMsg ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

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
                <Pressable style={[styles.chip, isNew && styles.chipOn]} onPress={() => setSelectedId(NEW_ITEM)}>
                  <Text style={[styles.chipText, isNew && styles.chipTextOn]}>+ Nuevo</Text>
                </Pressable>
              )}
            </View>

            {items.length === 0 && !isOrganizador && (
              <Text style={styles.hint}>No hay ítems. Pedí a la administradora que cree el primero.</Text>
            )}

            {isNew && (
              <>
                <Text style={styles.label}>Nombre</Text>
                <TextInput
                  style={styles.input}
                  value={nombre}
                  onChangeText={setNombre}
                  placeholder="Ej. Paracetamol o Pañales"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.label}>Umbral para reponer stock</Text>
                <TextInput
                  style={styles.input}
                  value={minima}
                  onChangeText={setMinima}
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.label}>Consumo teórico mensual (opcional)</Text>
                <TextInput
                  style={styles.input}
                  value={consumoMensual}
                  onChangeText={setConsumoMensual}
                  keyboardType="decimal-pad"
                  placeholder="Ej. 186"
                  placeholderTextColor={colors.textMuted}
                />
              </>
            )}

            <Text style={styles.label}>Cantidad comprada</Text>
            <TextInput
              style={styles.input}
              value={cantidad}
              onChangeText={setCantidad}
              keyboardType="decimal-pad"
              placeholder="Ej. 30"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Unidad de medida</Text>
            <TextInput
              style={styles.input}
              value={unidad}
              onChangeText={setUnidad}
              placeholder="unidad, comprimido, ml…"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Notas (opcional)</Text>
            <TextInput style={styles.input} value={notas} onChangeText={setNotas} placeholderTextColor={colors.textMuted} />

            <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Confirmar compra</Text>}
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
  title: { fontFamily: fonts.titleExtra, fontSize: 24, color: colors.text, marginBottom: 8 },
  label: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text, marginBottom: 8, marginTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.pinkStrong,
  },
  chipOn: { backgroundColor: colors.pinkDeep, borderColor: colors.pinkDeep },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  chipTextOn: { color: colors.white },
  hint: { fontSize: 13, color: colors.textMuted, marginTop: 8 },
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
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: { color: colors.error, fontSize: 14 },
  saveBtn: {
    backgroundColor: colors.pinkDeep,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnText: { fontFamily: fonts.title, color: colors.white, fontSize: 16 },
});
