import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { NavArrowButton } from './NavArrowButton';
import { EventTypeLegend } from './EventTypeLegend';
import { colors } from '../lib/theme';
import { fonts } from '../lib/typography';
import { EVENT_COLORS, type EventType } from '../lib/eventTypes';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

type Props = {
  year: number;
  month: number;
  selectedDate: string | null;
  todayKey?: string;
  eventDays: Map<string, Set<string>>;
  activeFilters: Set<EventType>;
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  compact?: boolean;
  showLegend?: boolean;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function CalendarGrid({
  year,
  month,
  selectedDate,
  todayKey,
  eventDays,
  activeFilters,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  compact = false,
  showLegend = false,
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
        <NavArrowButton direction="prev" onPress={onPrevMonth} />
        <Text style={styles.month}>{monthLabel}</Text>
        <NavArrowButton direction="next" onPress={onNextMonth} />
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
          const isToday = todayKey === key;
          const dotColors = filtered.slice(0, 3).map((t) => EVENT_COLORS[t as EventType]);

          return (
            <Pressable
              key={key}
              style={[
                styles.cell,
                isToday && styles.cellToday,
                selected && !isToday && styles.cellSelected,
                Platform.OS === 'web' && styles.webCursor,
              ]}
              onPress={() => onSelectDate(key)}
            >
              <Text style={[styles.dayNum, isToday && styles.dayNumToday, selected && styles.dayNumSelected]}>{day}</Text>
              {hasEvents && (
                <View style={styles.dotsRow}>
                  {dotColors.map((c, idx) => (
                    <View key={`${key}-${idx}`} style={[styles.dot, { backgroundColor: c }]} />
                  ))}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      {showLegend && <EventTypeLegend compact />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4 },
  month: { fontFamily: fonts.title, fontSize: 18, color: colors.text, textTransform: 'capitalize' },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: { flex: 1, textAlign: 'center', fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    borderRadius: 12,
  },
  cellToday: { backgroundColor: colors.pinkStrong, borderWidth: 2, borderColor: colors.pinkDeep },
  cellSelected: { backgroundColor: colors.green, borderWidth: 2, borderColor: colors.greenDark },
  dayNum: { fontFamily: fonts.body, fontSize: 15, color: colors.text },
  dayNumToday: { fontFamily: fonts.bodySemi, color: colors.white },
  dayNumSelected: { fontFamily: fonts.bodySemi, color: colors.fabText },
  dotsRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  webCursor: { cursor: 'pointer' } as object,
});
