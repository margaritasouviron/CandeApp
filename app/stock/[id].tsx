import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { StockBar } from '../../components/StockBar';
import { BackButton } from '../../components/BackButton';
import { useAuth } from '../../lib/auth';
import {
  ADQUISICION_LABELS,
  CLASIFICACION_LABELS,
  deleteInventoryItem,
  fetchInventoryItemDetail,
  fetchInventoryPurchases,
  updateInventoryItem,
  type InventoryAdquisicion,
  type InventoryClasificacion,
  type InventoryItem,
  type InventoryPurchaseRow,
} from '../../lib/inventory';
import { Screen } from '../../lib/screen';
import { colors } from '../../lib/theme';
import { fonts } from '../../lib/typography';

const CLASIFICACIONES: InventoryClasificacion[] = ['proteina', 'medicacion', 'insumo', 'crema'];
const ADQUISICIONES: (InventoryAdquisicion | null)[] = [null, 'compra_propia', 'osde'];

function formatPurchaseDate(iso: string) {
  return new Date(iso.includes('T') ? iso : `${iso}T12:00:00`).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function StockItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, role } = useAuth();
  const router = useRouter();
  const isOrganizador = role === 'organizador';

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [purchases, setPurchases] = useState<InventoryPurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftMinima, setDraftMinima] = useState('');
  const [draftUnidad, setDraftUnidad] = useState('');
  const [draftClasificacion, setDraftClasificacion] = useState<InventoryClasificacion>('insumo');
  const [draftAdquisicion, setDraftAdquisicion] = useState<InventoryAdquisicion | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [detail, rows] = await Promise.all([
        fetchInventoryItemDetail(id),
        fetchInventoryPurchases(id),
      ]);
      setItem(detail);
      setPurchases(rows);
      if (detail) {
        setDraftMinima(String(Number(detail.cantidad_minima)));
        setDraftUnidad(detail.unidad);
        setDraftClasificacion(detail.clasificacion);
        setDraftAdquisicion(detail.adquisicion);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (session && id) void load();
  }, [session, id, load]);

  if (!session) return <Redirect href="/login" />;

  const startEdit = () => {
    if (!item) return;
    setDraftMinima(String(Number(item.cantidad_minima)));
    setDraftUnidad(item.unidad);
    setDraftClasificacion(item.clasificacion);
    setDraftAdquisicion(item.adquisicion);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!item) return;
    const minima = parseFloat(draftMinima.replace(',', '.'));
    if (!Number.isFinite(minima) || minima < 0) {
      Alert.alert('Stock', 'Umbral inválido');
      return;
    }
    if (!draftUnidad.trim()) {
      Alert.alert('Stock', 'Indicá la unidad');
      return;
    }
    setSaving(true);
    try {
      await updateInventoryItem(item.id, {
        cantidad_minima: minima,
        unidad: draftUnidad.trim(),
        clasificacion: draftClasificacion,
        adquisicion: draftAdquisicion,
      });
      setEditing(false);
      await load();
    } catch {
      Alert.alert('Error', 'No se pudo guardar. ¿Aplicaste la migración 028?');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!item) return;
    Alert.alert('Borrar insumo', `¿Eliminar «${item.nombre}» del inventario?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteInventoryItem(item.id);
            router.replace({
              pathname: '/(tabs)/stock',
              params: { saved: '1', message: 'Insumo eliminado' },
            });
          } catch {
            Alert.alert('Error', 'No se pudo borrar el insumo');
          }
        },
      },
    ]);
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton />
        {loading ? (
          <ActivityIndicator color={colors.greenDark} style={{ marginTop: 32 }} />
        ) : !item ? (
          <Text style={styles.empty}>Insumo no encontrado</Text>
        ) : (
          <>
            <StockBar
              nombre={item.nombre}
              actual={Number(item.cantidad_actual)}
              minima={Number(item.cantidad_minima)}
              consumoMensual={Number(item.consumo_mensual ?? 0)}
              presentacion={item.presentacion}
              unidad={item.unidad}
              clasificacion={item.clasificacion}
              adquisicionLabel={item.adquisicion ? ADQUISICION_LABELS[item.adquisicion] : null}
            />

            {isOrganizador && !editing ? (
              <Pressable style={styles.editBtn} onPress={startEdit}>
                <Text style={styles.editBtnText}>Editar</Text>
              </Pressable>
            ) : null}

            {editing ? (
              <View style={styles.editPanel}>
                <Text style={styles.label}>Umbral (reponer bajo)</Text>
                <TextInput
                  style={styles.input}
                  value={draftMinima}
                  onChangeText={setDraftMinima}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.label}>Unidad de medida</Text>
                <TextInput style={styles.input} value={draftUnidad} onChangeText={setDraftUnidad} />
                <Text style={styles.label}>Clasificación</Text>
                <View style={styles.chips}>
                  {CLASIFICACIONES.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setDraftClasificacion(c)}
                      style={[styles.chip, draftClasificacion === c && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, draftClasificacion === c && styles.chipTextActive]}>
                        {CLASIFICACION_LABELS[c]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.label}>Adquisición</Text>
                <View style={styles.chips}>
                  {ADQUISICIONES.map((a) => (
                    <Pressable
                      key={a ?? 'none'}
                      onPress={() => setDraftAdquisicion(a)}
                      style={[styles.chip, draftAdquisicion === a && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, draftAdquisicion === a && styles.chipTextActive]}>
                        {a ? ADQUISICION_LABELS[a] : 'Sin definir'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.editActions}>
                  <Pressable onPress={() => setEditing(false)}>
                    <Text style={styles.cancelText}>Cancelar</Text>
                  </Pressable>
                  <Pressable style={styles.saveBtn} onPress={() => void saveEdit()} disabled={saving}>
                    {saving ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <Text style={styles.saveBtnText}>Guardar</Text>
                    )}
                  </Pressable>
                </View>
                <Pressable style={styles.deleteBtn} onPress={confirmDelete}>
                  <Text style={styles.deleteBtnText}>Borrar insumo</Text>
                </Pressable>
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>Últimas compras</Text>
            {purchases.length === 0 ? (
              <Text style={styles.empty}>Sin compras registradas</Text>
            ) : (
              purchases.map((p) => (
                <View key={p.id} style={styles.purchaseRow}>
                  <View style={styles.purchaseBody}>
                    <Text style={styles.purchaseQty}>
                      +{p.cantidad} {p.unidad}
                    </Text>
                    <Text style={styles.purchaseMeta}>{formatPurchaseDate(p.fecha_compra)}</Text>
                    {p.registrado_por_nombre ? (
                      <Text style={styles.purchaseMeta}>Por {p.registrado_por_nombre}</Text>
                    ) : null}
                    {p.notas ? <Text style={styles.purchaseNotes}>{p.notas}</Text> : null}
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  empty: { fontFamily: fonts.body, color: colors.textMuted, marginTop: 16 },
  sectionTitle: { fontFamily: fonts.title, fontSize: 17, color: colors.text, marginTop: 24, marginBottom: 10 },
  editBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: colors.pinkDeep,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  editBtnText: { fontFamily: fonts.bodySemi, color: colors.white, fontSize: 14 },
  editPanel: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.borderSoft,
    backgroundColor: colors.card,
  },
  label: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text, marginTop: 10, marginBottom: 6 },
  input: {
    borderWidth: 2,
    borderColor: colors.borderSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.white,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.brownLight,
  },
  chipActive: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.text },
  chipTextActive: { color: colors.white },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 16, alignItems: 'center' },
  cancelText: { fontFamily: fonts.bodySemi, color: colors.textMuted },
  saveBtn: {
    backgroundColor: colors.pinkDeep,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minWidth: 100,
    alignItems: 'center',
  },
  saveBtnText: { fontFamily: fonts.title, color: colors.white, fontSize: 15 },
  deleteBtn: { marginTop: 20, alignItems: 'center', paddingVertical: 8 },
  deleteBtnText: { fontFamily: fonts.bodySemi, color: colors.error, fontSize: 14 },
  purchaseRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  purchaseBody: { flex: 1 },
  purchaseQty: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  purchaseMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  purchaseNotes: { fontFamily: fonts.body, fontSize: 13, color: colors.text, marginTop: 4, fontStyle: 'italic' },
  ...(Platform.OS === 'web' ? ({ webCursor: { cursor: 'pointer' } } as object) : null),
});
