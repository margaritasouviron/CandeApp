import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
  PanResponder,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarGrid } from '../../components/CalendarGrid';
import { DayTimeGrid } from '../../components/DayTimeGrid';
import { FloatingActionButton } from '../../components/FloatingActionButton';
import { NavArrowButton } from '../../components/NavArrowButton';
import { TabHeader } from '../../components/TabHeader';
import { UpcomingDoseCard } from '../../components/UpcomingDoseCard';
import { useAuth } from '../../lib/auth';
import {
  addDays,
  dateKey,
  fetchDayJournal,
  fetchMonthEventDays,
  fetchDurationBlocksForDay,
  fetchWeekJournalTitles,
  type DurationBlock,
  type JournalLogItem,
} from '../../lib/careEvents';
import { EVENT_LABELS, EVENT_TYPES } from '../../lib/eventTypes';
import { fetchUpcomingDoses, registroParamsFromDose, type UpcomingDose } from '../../lib/medicationSchedules';
import { getPatient } from '../../lib/patientContext';
import { removeDoseAndFollowingFromList } from '../../lib/upcomingDoseActions';
import { Screen } from '../../lib/screen';
import { colors } from '../../lib/theme';
import { fonts } from '../../lib/typography';

type ViewMode = 'day' | 'week' | 'month';

function formatDayShort(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export default function CalendarScreen() {
  const router = useRouter();
  const { role } = useAuth();
  const { saved, message } = useLocalSearchParams<{ saved?: string; message?: string }>();
  const todayKey = dateKey(new Date());

  const [mode, setMode] = useState<ViewMode>('day');
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [eventDays, setEventDays] = useState<Map<string, Set<string>>>(new Map());
  const [dayLogs, setDayLogs] = useState<JournalLogItem[]>([]);
  const [durationBlocks, setDurationBlocks] = useState<DurationBlock[]>([]);
  const [weekData, setWeekData] = useState<{ days: string[]; byDay: Map<string, JournalLogItem[]> } | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingDose[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const isOrganizador = role === 'organizador';
  const isToday = selectedDate === todayKey;
  const nextTen = upcoming.slice(0, 10);

  const calendarTitle =
    mode === 'month'
      ? 'Calendario mensual'
      : mode === 'week'
        ? 'Calendario semanal'
        : formatDayShort(selectedDate);

  const daySwipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => mode !== 'month' && Math.abs(g.dx) > 24 && Math.abs(g.dy) < 20,
        onPanResponderRelease: (_, g) => {
          if (g.dx > 40) setSelectedDate((d) => addDays(d, -1));
          else if (g.dx < -40) setSelectedDate((d) => addDays(d, 1));
        },
      }),
    [mode]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const patient = await getPatient();
      if (!patient) return;

      const [monthMap, upcomingList] = await Promise.all([
        fetchMonthEventDays(patient.id, year, month),
        fetchUpcomingDoses(patient.id, 120),
      ]);
      setEventDays(monthMap);
      setUpcoming(upcomingList);

      if (mode === 'day') {
        const [logs, durations] = await Promise.all([
          fetchDayJournal(patient.id, selectedDate),
          fetchDurationBlocksForDay(patient.id, selectedDate),
        ]);
        setDayLogs(logs);
        setDurationBlocks(durations);
      } else if (mode === 'week') {
        setWeekData(await fetchWeekJournalTitles(patient.id, selectedDate));
      }
    } finally {
      setLoading(false);
    }
  }, [year, month, mode, selectedDate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (saved === '1' && message) {
      setToast(message);
      const timer = setTimeout(() => setToast(null), 5000);
      router.setParams({ saved: undefined, message: undefined });
      return () => clearTimeout(timer);
    }
  }, [saved, message, router]);

  const confirmDose = (dose: UpcomingDose) => {
    router.push({ pathname: '/registro', params: registroParamsFromDose(dose) });
  };

  return (
    <Screen>
      <View style={styles.flex}>
        <View style={styles.header}>
          <TabHeader title="Calendario" subtitle="Registros y medicación" />
        </View>

        {toast ? (
          <View style={styles.toast}>
            <Text style={styles.toastText}>✓ {toast}</Text>
          </View>
        ) : null}

        <View style={styles.bodySplit}>
        <View style={styles.calendarSection}>
          <View style={styles.topBar}>
            <View style={styles.modeCluster}>
              {(['day', 'week', 'month'] as ViewMode[]).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  style={[styles.modeTiny, mode === m && styles.modeTinyOn]}
                >
                  <Text style={[styles.modeTinyText, mode === m && styles.modeTinyTextOn]}>
                    {m === 'day' ? 'Día' : m === 'week' ? 'Sem' : 'Mes'}
                  </Text>
                </Pressable>
              ))}
            </View>
            {mode !== 'month' && (
              <View style={styles.dateNav}>
                <NavArrowButton direction="prev" onPress={() => setSelectedDate((d) => addDays(d, -1))} />
                <NavArrowButton direction="next" onPress={() => setSelectedDate((d) => addDays(d, 1))} />
              </View>
            )}
          </View>

          <Text style={[styles.calendarTitle, isToday && mode === 'day' && styles.calendarTitleToday]}>
            {calendarTitle}
          </Text>

          <View style={styles.calendarBox} {...(mode !== 'month' ? daySwipe.panHandlers : {})}>
            {loading && mode === 'day' ? (
              <ActivityIndicator color={colors.greenDark} style={styles.loader} />
            ) : null}

            {mode === 'day' && !loading && (
              <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                <DayTimeGrid
                  dateStr={selectedDate}
                  logs={dayLogs}
                  durationBlocks={durationBlocks}
                  scheduled={upcoming}
                  onLogPress={(logId) => router.push(`/log/${logId}`)}
                />
              </ScrollView>
            )}

            {mode === 'week' && weekData && (
              <ScrollView nestedScrollEnabled>
                {weekData.days.map((day) => (
                  <View key={day} style={[styles.weekDay, day === todayKey && styles.weekDayToday]}>
                    <Text style={styles.weekDayTitle}>{formatDayShort(day)}</Text>
                    {(weekData.byDay.get(day) ?? []).map((log) => (
                      <Pressable key={log.id} onPress={() => router.push(`/log/${log.id}`)} style={styles.weekItemPress}>
                        <Text style={styles.weekItem}>
                          {EVENT_LABELS[log.tipo]} — <Text style={styles.weekItemTitle}>{log.title}</Text>
                        </Text>
                      </Pressable>
                    ))}
                    {(weekData.byDay.get(day) ?? []).length === 0 && (
                      <Text style={styles.emptyInline}>Sin registros</Text>
                    )}
                  </View>
                ))}
              </ScrollView>
            )}

            {mode === 'month' && (
              <ScrollView nestedScrollEnabled>
                <CalendarGrid
                  year={year}
                  month={month}
                  selectedDate={selectedDate}
                  todayKey={todayKey}
                  eventDays={eventDays}
                  activeFilters={new Set(EVENT_TYPES)}
                  onSelectDate={(d) => {
                    setSelectedDate(d);
                    setMode('day');
                  }}
                  onPrevMonth={() => {
                    if (month === 0) {
                      setMonth(11);
                      setYear((y) => y - 1);
                    } else setMonth((m) => m - 1);
                  }}
                  onNextMonth={() => {
                    if (month === 11) {
                      setMonth(0);
                      setYear((y) => y + 1);
                    } else setMonth((m) => m + 1);
                  }}
                  compact
                  showLegend
                />
              </ScrollView>
            )}
          </View>

        </View>

        <View style={styles.upcomingPanel}>
          <Text style={styles.upcomingTitle}>Próximos 10 eventos</Text>
          <ScrollView style={styles.upcomingScroll} nestedScrollEnabled showsVerticalScrollIndicator>
            {nextTen.length === 0 ? (
              <Text style={styles.emptyInline}>Sin eventos programados</Text>
            ) : (
              nextTen.map((dose) => (
                <UpcomingDoseCard
                  key={dose.id}
                  dose={dose}
                  muted
                  showConfirm
                  onConfirm={() => confirmDose(dose)}
                  showDelete={isOrganizador}
                  onDeleted={() => setUpcoming((prev) => removeDoseAndFollowingFromList(prev, dose))}
                />
              ))
            )}
          </ScrollView>
        </View>
        </View>

        <FloatingActionButton label="Registro" onPress={() => router.push('/registro')} bottomOffset={56} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 4 },
  toast: {
    marginHorizontal: 16,
    marginBottom: 6,
    backgroundColor: colors.green,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1.5,
    borderColor: colors.greenDark,
  },
  toastText: { fontFamily: fonts.bodySemi, color: colors.text, fontSize: 13 },
  bodySplit: { flex: 1, minHeight: 0 },
  calendarSection: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 12,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modeCluster: { flexDirection: 'row', gap: 4 },
  modeTiny: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.pinkStrong,
    backgroundColor: colors.card,
  },
  modeTinyOn: { backgroundColor: colors.pinkDeep, borderColor: colors.pinkDeep },
  modeTinyText: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },
  modeTinyTextOn: { fontFamily: fonts.bodySemi, color: colors.white },
  dateNav: { flexDirection: 'row', gap: 6 },
  calendarTitle: {
    fontFamily: fonts.title,
    fontSize: 15,
    color: colors.text,
    marginBottom: 6,
    textTransform: 'capitalize',
    paddingHorizontal: 2,
  },
  calendarTitleToday: { color: colors.pinkDeep },
  calendarBox: {
    flex: 1,
    minHeight: 120,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
  },
  loader: { marginVertical: 40 },
  weekDay: {
    marginHorizontal: 8,
    marginVertical: 6,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.backgroundAlt,
  },
  weekDayToday: { borderColor: colors.pinkDeep, backgroundColor: colors.pink },
  weekDayTitle: {
    fontFamily: fonts.title,
    fontSize: 12,
    color: colors.text,
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  weekItemPress: { paddingVertical: 3 },
  weekItem: { fontFamily: fonts.body, fontSize: 11, color: colors.text },
  weekItemTitle: { fontFamily: fonts.title },
  emptyInline: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  upcomingPanel: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'web' ? 8 : 4,
  },
  upcomingTitle: {
    fontFamily: fonts.title,
    fontSize: 14,
    color: colors.text,
    marginBottom: 6,
  },
  upcomingScroll: { flex: 1 },
});
