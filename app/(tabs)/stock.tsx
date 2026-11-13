import { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  filterInventoryItems,
  fetchInventory,
  inventoryStockStatus,
  type InventoryClasificacion,
  type InventoryItem,
} from '../../lib/inventory';
import { getPatient } from '../../lib/patientContext';
import { Screen } from '../../lib/screen';
import { useAppColors } from '../../lib/ThemeModeProvider';
import { fonts } from '../../lib/typography';
import type { AppColors } from '../../lib/theme';

type FilterKey = 'all' | InventoryClasificacion;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'proteina', label: 'P · Proteína' },
  { key: 'medicacion', label: 'M · Medicación' },
  { key: 'insumo', label: 'I · Insumo' },
  { key: 'crema', label: 'C · Cremas' },
];

export default function StockScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { saved, message } = useLocalSearchParams<{ saved?: string; message?: string }>();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

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

  const filtered = useMemo(
    () => filterInventoryItems(items, { query: search, clasificacion: filter }),
    [items, search, filter]
  );

  const alertCount = items.filter((i) => {
    const s = inventoryStockStatus(i);
    return s === 'low' || s === 'near';
  }).length;

  return (
    <Screen>
      <View style={styles.flex}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.greenDark} />}
          keyboardShouldPersistTaps="handled"
        >
          <TabHeader
            title="Stock"
            subtitle={alertCount > 0 ? `${alertCount} insumo(s) cerca de agotarse` : 'Inventario de insumos'}
          />

          {toast ? (
            <View style={styles.toast}>
              <Text style={styles.toastText}>✓ {toast}</Text>
            </View>
          ) : null}

          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar insumo…"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{f.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {loading && items.length === 0 ? (
            <ActivityIndicator color={colors.greenDark} style={{ marginTop: 24 }} />
          ) : filtered.length === 0 ? (
            <Text style={styles.empty}>
              {items.length === 0
                ? 'No hay ítems en inventario. Agregá una compra para crear el primer ítem.'
                : 'Ningún insumo coincide con la búsqueda o el filtro.'}
            </Text>
          ) : (
            <View style={styles.list}>
              {filtered.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/stock/${item.id}`)}
                  style={({ pressed }) => [styles.itemPress, pressed && styles.itemPressActive]}
                >
                  <StockBar
                    nombre={item.nombre}
                    actual={Number(item.cantidad_actual)}
                    minima={Number(item.cantidad_minima)}
                    consumoMensual={Number(item.consumo_mensual ?? 0)}
                    presentacion={item.presentacion}
                    unidad={item.unidad}
                    clasificacion={item.clasificacion}
                  />
                </Pressable>
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

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    container: { flex: 1 },
    content: { paddingBottom: Platform.OS === 'web' ? 120 : 140 },
    toast: {
      marginHorizontal: 20,
      marginBottom: 12,
      backgroundColor: colors.upcomingFill,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.green,
    },
    toastText: { fontFamily: fonts.bodySemi, color: colors.greenDark, fontSize: 14 },
    search: {
      marginHorizontal: 20,
      marginBottom: 12,
      borderWidth: 2,
      borderColor: colors.borderSoft,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: fonts.body,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.card,
    },
    filterRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      backgroundColor: colors.brownLight,
    },
    filterChipActive: { backgroundColor: colors.pinkDeep, borderColor: colors.pinkDeep },
    filterChipText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.text },
    filterChipTextActive: { color: colors.white },
    list: { paddingHorizontal: 20 },
    itemPress: { marginBottom: 0, ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null) },
    itemPressActive: { opacity: 0.92 },
    empty: { fontFamily: fonts.body, color: colors.textMuted, paddingHorizontal: 20, lineHeight: 22 },
  });
}
