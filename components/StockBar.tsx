import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../lib/theme';

type Props = {
  nombre: string;
  actual: number;
  minima: number;
  unidad: string;
};

export function StockBar({ nombre, actual, minima, unidad }: Props) {
  const low = actual <= minima;
  const pct = minima > 0 ? Math.min(100, (actual / (minima * 2)) * 100) : actual > 0 ? 100 : 0;

  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <Text style={styles.name}>{low ? '⚠ ' : ''}{nombre}</Text>
        <Text style={styles.qty}>{actual} {unidad}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: low ? colors.error : colors.blue }]} />
      </View>
      {low && <Text style={styles.alert}>Alerta stock — mínimo {minima} {unidad}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text, flex: 1 },
  qty: { fontSize: 14, color: colors.textMuted },
  track: { height: 10, backgroundColor: colors.brownLight, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  alert: { fontSize: 12, color: colors.error, marginTop: 6, fontWeight: '600' },
});
