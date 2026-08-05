import { View, Text, StyleSheet } from 'react-native';
import { EVENT_COLORS, EVENT_LABELS, type EventType } from '../lib/eventTypes';
import { colors } from '../lib/theme';

type Props = {
  tipo: string;
  time: string;
  title: string;
  subtitle?: string;
};

export function EventCard({ tipo, time, title, subtitle }: Props) {
  const color = EVENT_COLORS[tipo as EventType] ?? colors.textMuted;
  return (
    <View style={styles.card}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={styles.body}>
        <Text style={styles.time}>{time}</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
        <Text style={[styles.badge, { color }]}>{EVENT_LABELS[tipo as EventType] ?? tipo}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, marginRight: 12 },
  body: { flex: 1 },
  time: { fontSize: 13, fontWeight: '700', color: colors.blue },
  title: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 2 },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  badge: { fontSize: 12, fontWeight: '600', marginTop: 6 },
});
