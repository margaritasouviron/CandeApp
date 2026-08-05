import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StockBar } from '../../components/StockBar';
import { TabHeader } from '../../components/TabHeader';
import { fetchInventory, type InventoryItem } from '../../lib/inventory';
import { getPatient } from '../../lib/patientContext';
import { Screen } from '../../lib/screen';
import { colors } from '../../lib/theme';

export default function StockScreen() {
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  const lowCount = items.filter((i) => i.cantidad_actual <= i.cantidad_minima).length;

  return (
    <Screen>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.blue} />}
      >
        <TabHeader
          title="Stock"
          subtitle={lowCount > 0 ? `${lowCount} alerta(s) de stock bajo` : 'Inventario de insumos'}
        />

        {loading && items.length === 0 ? (
          <ActivityIndicator color={colors.blue} style={{ marginTop: 24 }} />
        ) : items.length === 0 ? (
          <Text style={styles.empty}>
            No hay ítems en inventario. Agregá una compra para crear el primer ítem (requiere perfil administrador).
          </Text>
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.itemWrap}>
              <StockBar
                nombre={item.nombre}
                actual={Number(item.cantidad_actual)}
                minima={Number(item.cantidad_minima)}
                unidad={item.unidad}
              />
            </View>
          ))
        )}

        <Pressable
          style={[styles.fab, Platform.OS === 'web' && styles.fabWeb]}
          onPress={() => router.push('/stock/add-purchase')}
        >
          <Text style={styles.fabText}>+ Agregar compra</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: Platform.OS === 'web' ? 100 : 120 },
  itemWrap: { paddingHorizontal: 20 },
  empty: { color: colors.textMuted, paddingHorizontal: 20, lineHeight: 22 },
  fab: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: colors.blue,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  fabWeb: {
    position: 'relative',
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 32,
  },
  fabText: { color: colors.white, fontSize: 17, fontWeight: '700' },
});
