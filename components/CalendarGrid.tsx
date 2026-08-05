import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { colors } from '../lib/theme';
import { EVENT_COLORS, EVENT_LABELS, EVENT_TYPES, type EventType } from '../lib/eventTypes';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

type Props = {
  year: number;
  month: number;
  selectedDate: string | null;
  eventDays: Map<string, Set<string>>;
  activeFilters: Set<EventType>;
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function CalendarGrid({
  year,
  month,
  selectedDate,
  eventDays,
  activeFilters,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}: Props) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let startDow = first.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthLabel = first.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  return (
    <View style={styles.wrap}>
      <View style={styles.nav}>
        <Pressable onPress={onPrevMonth} style={styles.navBtn}><Text style={styles.navText}>‹</Text></Pressable>
        <Text style={styles.month}>{monthLabel}</Text>
        <Pressable onPress={onNextMonth} style={styles.navBtn}><Text style={styles.navText}>›</Text></Pressable>
      </View>
      <View style={styles.weekRow}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={styles.weekday}>{w}</Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (day === null) return <View key={`e-${i}`} style={styles.cell} />;
          const key = `${year}-${pad(month + 1)}-${pad(day)}`;
          const types = eventDays.get(key);
          const filtered = types
            ? [...types].filter((t) => activeFilters.has(t as EventType))
            : [];
          const hasEvents = filtered.length > 0;
          const selected = selectedDate === key;
          const dotColor = filtered[0] ? EVENT_COLORS[filtered[0] as EventType] : colors.blue;

          return (
            <Pressable
              key={key}
              style={[styles.cell, selected && styles.cellSelected, Platform.OS === 'web' && styles.webCursor]}
              onPress={() => onSelectDate(key)}
            >
              <Text style={[styles.dayNum, selected && styles.dayNumSelected]}>{day}</Text>
              {hasEvents && <View style={[styles.dot, { backgroundColor: dotColor }]} />}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Leyenda</Text>
        {EVENT_TYPES.map((t) => (
          <View key={t} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: EVENT_COLORS[t] }]} />
            <Text style={styles.legendText}>{EVENT_LABELS[t]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: { padding: 12 },
  navText: { fontSize: 28, color: colors.blue, fontWeight: '300' },
  month: { fontSize: 18, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  cellSelected: { backgroundColor: colors.brownLight, borderRadius: 12 },
  dayNum: { fontSize: 15, color: colors.text },
  dayNumSelected: { fontWeight: '700', color: colors.blueDark },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
  legend: { marginTop: 16, padding: 12, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  legendTitle: { fontWeight: '700', color: colors.text, marginBottom: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  legendText: { fontSize: 13, color: colors.textMuted, textTransform: 'capitalize' },
  webCursor: { cursor: 'pointer' } as object,
});
