import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
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
import { fetchInventory, type InventoryItem } from '../../lib/inventory';
import { getPatient } from '../../lib/patientContext';
import { Screen } from '../../lib/screen';
import { colors } from '../../lib/theme';
import { fonts } from '../../lib/typography';

export default function StockScreen() {
  const router = useRouter();
  const { saved, message } = useLocalSearchParams<{ saved?: string; message?: string }>();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

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
                <StockBar
                  key={item.id}
                  nombre={item.nombre}
                  actual={Number(item.cantidad_actual)}
                  minima={Number(item.cantidad_minima)}
                  unidad={item.unidad}
                />
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
  empty: { fontFamily: fonts.body, color: colors.textMuted, paddingHorizontal: 20, lineHeight: 22 },
});
