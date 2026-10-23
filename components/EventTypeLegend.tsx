import { View, Text, StyleSheet } from 'react-native';
import { EVENT_COLORS, EVENT_LABELS, EVENT_TYPES } from '../lib/eventTypes';
import { colors } from '../lib/theme';
import { fonts } from '../lib/typography';

type Props = { compact?: boolean };

export function EventTypeLegend({ compact = false }: Props) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={styles.title}>Qué significan los colores</Text>
      <View style={styles.grid}>
        {EVENT_TYPES.map((t) => (
          <View key={t} style={[styles.row, compact && styles.rowCompact]}>
            <View style={[styles.dot, { backgroundColor: EVENT_COLORS[t] }]} />
            <Text style={styles.label} numberOfLines={1}>
              {EVENT_LABELS[t]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
    padding: 10,
    backgroundColor: colors.backgroundAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  wrapCompact: { marginHorizontal: 4, marginBottom: 4 },
  title: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.text, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', width: '48%', marginBottom: 4 },
  rowCompact: { width: '47%' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  label: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, flex: 1 },
});
