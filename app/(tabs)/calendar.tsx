import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CalendarGrid } from '../../components/CalendarGrid';
import { TabHeader } from '../../components/TabHeader';
import { fetchMonthEventDays } from '../../lib/careEvents';
import { EVENT_LABELS, EVENT_TYPES, type EventType } from '../../lib/eventTypes';
import { getPatient } from '../../lib/patientContext';
import { Screen } from '../../lib/screen';
import { colors } from '../../lib/theme';

export default function CalendarScreen() {
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [eventDays, setEventDays] = useState<Map<string, Set<string>>>(new Map());
  const [activeFilters, setActiveFilters] = useState<Set<EventType>>(new Set(EVENT_TYPES));
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const patient = await getPatient();
      if (!patient) return;
      setEventDays(await fetchMonthEventDays(patient.id, year, month));
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFilter = (t: EventType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next.size === 0 ? new Set(EVENT_TYPES) : next;
    });
  };

  const onSelectDate = (date: string) => {
    router.push(`/day/${date}`);
  };

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  return (
    <Screen>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TabHeader title="Calendario" subtitle="Tocá un día para ver detalle" />

        {loading ? (
          <ActivityIndicator color={colors.blue} style={{ marginTop: 24 }} />
        ) : (
          <CalendarGrid
            year={year}
            month={month}
            selectedDate={null}
            eventDays={eventDays}
            activeFilters={activeFilters}
            onSelectDate={onSelectDate}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
          />
        )}

        <View style={styles.filters}>
          <Text style={styles.filterTitle}>Filtrar eventos</Text>
          <View style={styles.chips}>
            {EVENT_TYPES.map((t) => {
              const on = activeFilters.has(t);
              return (
                <Pressable
                  key={t}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => toggleFilter(t)}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{EVENT_LABELS[t]}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: Platform.OS === 'web' ? 32 : 24 },
  filters: { marginHorizontal: 20, marginTop: 16 },
  filterTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.brownLight,
  },
  chipOn: { backgroundColor: colors.blue },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.brown },
  chipTextOn: { color: colors.white },
});
