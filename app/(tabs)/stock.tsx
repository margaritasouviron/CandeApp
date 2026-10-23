import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StockBar } from '../../components/StockBar';
import { TabHeader } from '../../components/TabHeader';
import { FloatingActionButton } from '../../components/FloatingActionButton';
import { useAuth } from '../../lib/auth';
import { fetchInventory, updateInventoryStock, type InventoryItem } from '../../lib/inventory';
import { getPatient } from '../../lib/patientContext';
import { Screen } from '../../lib/screen';
import { colors } from '../../lib/theme';
import { fonts } from '../../lib/typography';

export default function StockScreen() {
  const router = useRouter();
  const { role } = useAuth();
  const isOrganizador = role === 'organizador';
  const { saved, message } = useLocalSearchParams<{ saved?: string; message?: string }>();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftQty, setDraftQty] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const patient = await getPatient();
      if (!patient) {
        setItems([]);
        return;
      }
      setItems(await fetchInventory(patient.id));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (saved === '1' && message) {
      setToast(message);
      load();
      const timer = setTimeout(() => setToast(null), 5000);
      router.setParams({ saved: undefined, message: undefined });
      return () => clearTimeout(timer);
    }
  }, [saved, message, router, load]);

  const lowCount = items.filter((i) =>
    Number(i.cantidad_minima) > 0
      ? Number(i.cantidad_actual) < Number(i.cantidad_minima)
      : Number(i.cantidad_actual) <= 0
  ).length;

  const startAdjust = (item: InventoryItem) => {
    setAdjustError(null);
    setEditingId(item.id);
    setDraftQty(String(Number(item.cantidad_actual)));
  };

  const cancelAdjust = () => {
    setEditingId(null);
    setDraftQty('');
    setAdjustError(null);
  };

  const saveAdjust = async (item: InventoryItem) => {
    const qty = parseFloat(draftQty.replace(',', '.'));
    if (!Number.isFinite(qty) || qty < 0) {
      setAdjustError('Indica una cantidad válida (0 o más)');
      return;
    }
    setSavingId(item.id);
    setAdjustError(null);
    try {
      await updateInventoryStock(item.id, qty);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, cantidad_actual: qty } : i))
      );
      setToast(`Stock de ${item.nombre} actualizado`);
      cancelAdjust();
      setTimeout(() => setToast(null), 5000);
    } catch (e) {
      setAdjustError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Screen>
      <View style={styles.flex}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.greenDark} />}
        >
          <TabHeader
            title="Stock"
            subtitle={lowCount > 0 ? `${lowCount} alerta(s) de stock bajo` : 'Inventario de insumos'}
          />

          {toast ? (
            <View style={styles.toast}>
              <Text style={styles.toastText}>✓ {toast}</Text>
            </View>
          ) : null}

          {loading && items.length === 0 ? (
            <ActivityIndicator color={colors.greenDark} style={{ marginTop: 24 }} />
          ) : items.length === 0 ? (
            <Text style={styles.empty}>
              No hay ítems en inventario. Agregá una compra para crear el primer ítem.
            </Text>
          ) : (
            <View style={styles.list}>
              {items.map((item) => (
                <View key={item.id} style={styles.itemBlock}>
                  <StockBar
                    nombre={item.nombre}
                    actual={Number(item.cantidad_actual)}
                    minima={Number(item.cantidad_minima)}
                    unidad={item.unidad}
                  />
                  {isOrganizador && editingId === item.id ? (
                    <View style={styles.adjustPanel}>
                      <Text style={styles.adjustLabel}>Cantidad actual ({item.unidad})</Text>
                      <TextInput
                        style={styles.adjustInput}
                        value={draftQty}
                        onChangeText={setDraftQty}
                        keyboardType="decimal-pad"
                        placeholderTextColor={colors.textMuted}
                        autoFocus
                      />
                      {adjustError ? <Text style={styles.adjustError}>{adjustError}</Text> : null}
                      <View style={styles.adjustActions}>
                        <Pressable style={styles.adjustCancel} onPress={cancelAdjust} disabled={savingId === item.id}>
                          <Text style={styles.adjustCancelText}>Cancelar</Text>
                        </Pressable>
                        <Pressable
                          style={styles.adjustSave}
                          onPress={() => void saveAdjust(item)}
                          disabled={savingId === item.id}
                        >
                          {savingId === item.id ? (
                            <ActivityIndicator color={colors.white} size="small" />
                          ) : (
                            <Text style={styles.adjustSaveText}>Guardar</Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  ) : isOrganizador ? (
                    <Pressable style={styles.adjustLink} onPress={() => startAdjust(item)}>
                      <Text style={styles.adjustLinkText}>Ajustar cantidad actual</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <FloatingActionButton
          label="Compra"
          onPress={() => router.push('/stock/add-purchase')}
          bottomOffset={56}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  content: { paddingBottom: Platform.OS === 'web' ? 120 : 140 },
  toast: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#dcfce7',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.green,
  },
  toastText: { fontFamily: fonts.bodySemi, color: colors.greenDark, fontSize: 14 },
  list: { paddingHorizontal: 20 },
  itemBlock: { marginBottom: 4 },
  adjustLink: { marginTop: -4, marginBottom: 12, alignSelf: 'flex-start', paddingVertical: 4 },
  adjustLinkText: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: colors.pinkDeep,
    textDecorationLine: 'underline',
  },
  adjustPanel: {
    marginTop: -4,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderSoft,
    backgroundColor: colors.card,
  },
  adjustLabel: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text, marginBottom: 8 },
  adjustInput: {
    borderWidth: 2,
    borderColor: colors.pinkStrong,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.white,
  },
  adjustError: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.error, marginTop: 8 },
  adjustActions: { flexDirection: 'row', gap: 10, marginTop: 12, justifyContent: 'flex-end' },
  adjustCancel: { paddingVertical: 10, paddingHorizontal: 14 },
  adjustCancelText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.textMuted },
  adjustSave: {
    backgroundColor: colors.pinkDeep,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
    minWidth: 100,
    alignItems: 'center',
  },
  adjustSaveText: { fontFamily: fonts.title, fontSize: 15, color: colors.white },
  empty: { fontFamily: fonts.body, color: colors.textMuted, paddingHorizontal: 20, lineHeight: 22 },
});
