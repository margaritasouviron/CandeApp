import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../lib/theme';
import { fonts } from '../lib/typography';

type Props = {
  nombre: string;
  actual: number;
  minima: number;
  consumoMensual?: number;
  presentacion?: string | null;
  unidad: string;
};

function formatQty(n: number) {
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function StockBar({ nombre, actual, minima, consumoMensual = 0, presentacion, unidad }: Props) {
  const low = minima > 0 ? actual < minima : actual <= 0;
  const referencia = minima > 0 ? Math.max(minima * 2, actual, minima) : Math.max(actual, 1);
  const pct = Math.min(100, Math.max(0, (actual / referencia) * 100));
  const thresholdPct = minima > 0 ? Math.min(100, (minima / referencia) * 100) : null;

  return (
    <View style={[styles.card, low && styles.cardLow]}>
      <View style={styles.header}>
        <Text style={styles.name}>{nombre}</Text>
        <Text style={[styles.qty, low && styles.qtyLow]}>
          {actual} {unidad}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }, low ? styles.fillLow : styles.fillOk]} />
        {thresholdPct != null && thresholdPct > 0 && thresholdPct < 100 ? (
          <View style={[styles.threshold, { left: `${thresholdPct}%` }]} />
        ) : null}
      </View>
      <View style={styles.metaRow}>
        {consumoMensual > 0 ? (
          <Text style={styles.meta}>
            Consumo teórico/mes: {formatQty(consumoMensual)} {unidad}
          </Text>
        ) : null}
        {minima > 0 ? (
          <Text style={styles.meta}>
            Reponer bajo: {formatQty(minima)} {unidad}
          </Text>
        ) : null}
      </View>
      {presentacion ? <Text style={styles.presentation}>{presentacion}</Text> : null}
      {low ? <Text style={styles.alert}>Stock bajo</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: colors.pinkStrong,
  },
  cardLow: {
    borderColor: colors.error,
    backgroundColor: '#FFF5F5',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  name: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.text, flex: 1, paddingRight: 8 },
  qty: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.greenDark },
  qtyLow: { color: colors.error },
  track: {
    height: 14,
    backgroundColor: colors.brownLight,
    borderRadius: 7,
    overflow: 'visible',
    position: 'relative',
  },
  fill: { height: '100%', borderRadius: 7 },
  fillOk: { backgroundColor: colors.green },
  fillLow: { backgroundColor: colors.error },
  threshold: {
    position: 'absolute',
    top: -3,
    bottom: -3,
    width: 2,
    marginLeft: -1,
    backgroundColor: colors.text,
    borderRadius: 1,
    opacity: 0.65,
  },
  metaRow: { marginTop: 8, gap: 2 },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, lineHeight: 16 },
  presentation: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 4, fontStyle: 'italic' },
  alert: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.error, marginTop: 8 },
});
