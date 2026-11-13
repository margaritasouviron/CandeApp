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
import { useFocusEffect, useGlobalSearchParams, useRouter } from 'expo-router';
import { CalendarGrid } from '../../components/CalendarGrid';
import { CalendarAddEventModal } from '../../components/CalendarAddEventModal';
import { DayTimeGrid } from '../../components/DayTimeGrid';
import { FloatingActionButton } from '../../components/FloatingActionButton';
import { NavArrowButton } from '../../components/NavArrowButton';
import { TabHeader } from '../../components/TabHeader';
import { UpcomingDoseCard } from '../../components/UpcomingDoseCard';
import { UpcomingTurnoCard } from '../../components/UpcomingTurnoCard';
import { useAuth } from '../../lib/auth';
import {
  addDays,
  dateKey,
  fetchDayJournal,
  fetchMonthEventDays,
  fetchDurationBlocksForDay,
  mergeDurationBlocksForDay,
  fetchWeekJournalTitles,
  type DurationBlock,
  type JournalLogItem,
} from '../../lib/careEvents';
import { EVENT_LABELS, EVENT_TYPES, type RegistroTipo } from '../../lib/eventTypes';
import { fetchUpcomingDoses, registroParamsFromDose, type UpcomingDose } from '../../lib/medicationSchedules';
import {
  fetchUpcomingMedicalTurnos,
  mergeCalendarUpcoming,
  type CalendarUpcomingItem,
} from '../../lib/medicalAppointments';
import { getPatient } from '../../lib/patientContext';
import { removeDoseAndFollowingFromList } from '../../lib/upcomingDoseActions';
import { Screen } from '../../lib/screen';
import { colors } from '../../lib/theme';
import { fonts } from '../../lib/typography';
import { consumeCalendarFeedback } from '../../lib/calendarFeedback';
import { firstSearchParam } from '../../lib/routeParams';

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
  const rawParams = useGlobalSearchParams<{
    saved?: string | string[];
    message?: string | string[];
    date?: string | string[];
  }>();
  const saved = firstSearchParam(rawParams.saved);
  const message = firstSearchParam(rawParams.message);
  const returnDate = firstSearchParam(rawParams.date);
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
  const [upcomingTurnos, setUpcomingTurnos] = useState<CalendarUpcomingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [addEventSlot, setAddEventSlot] = useState<string | null>(null);

  const isOrganizador = role === 'organizador';
  const isToday = selectedDate === todayKey;
  const nextTen = upcomingTurnos;

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

      const [monthMap, upcomingList, turnoList] = await Promise.all([
        fetchMonthEventDays(patient.id, year, month),
        fetchUpcomingDoses(patient.id, 120),
        fetchUpcomingMedicalTurnos(patient.id, 120).catch(() => []),
      ]);
      setEventDays(monthMap);
      setUpcoming(upcomingList);
      setUpcomingTurnos(mergeCalendarUpcoming(upcomingList, turnoList, 10));

      if (mode === 'day') {
        const [logs, durations] = await Promise.all([
          fetchDayJournal(patient.id, selectedDate),
          fetchDurationBlocksForDay(patient.id, selectedDate),
        ]);
        setDayLogs(logs);
        setDurationBlocks(mergeDurationBlocksForDay(durations, logs));
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

  const applyFeedbackDate = useCallback((dateStr: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
    setSelectedDate(dateStr);
    const [y, mo] = dateStr.split('-').map(Number);
    setYear(y);
    setMonth(mo - 1);
    setMode('day');
  }, []);

  useFocusEffect(
    useCallback(() => {
      const fb = consumeCalendarFeedback();
      if (fb) {
        setToast(fb.message);
        if (fb.date) applyFeedbackDate(fb.date);
      } else if (saved === '1' && message) {
        setToast(message);
        if (returnDate) applyFeedbackDate(returnDate);
      }
    }, [saved, message, returnDate, applyFeedbackDate])
  );

  useEffect(() => {
    if (returnDate && /^\d{4}-\d{2}-\d{2}$/.test(returnDate)) {
      applyFeedbackDate(returnDate);
    }
  }, [returnDate, applyFeedbackDate]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const confirmDose = (dose: UpcomingDose) => {
    router.push({ pathname: '/registro', params: registroParamsFromDose(dose) });
  };

  const openRegistroFromSlot = (tipo: RegistroTipo) => {
    const hora = addEventSlot;
    setAddEventSlot(null);
    if (!hora) return;
    router.push({
      pathname: '/registro',
      params: { date: selectedDate, hora, tipo },
    });
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
                  onSlotLongPress={(timeHm) => setAddEventSlot(timeHm)}
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
              nextTen.map((item) =>
                item.kind === 'dose' ? (
                  <UpcomingDoseCard
                    key={`dose-${item.dose.id}`}
                    dose={item.dose}
                    muted
                    showConfirm
                    onConfirm={() => confirmDose(item.dose)}
                    showDelete={isOrganizador}
                    onDeleted={() => {
                      const nextDoses = removeDoseAndFollowingFromList(upcoming, item.dose);
                      setUpcoming(nextDoses);
                      setUpcomingTurnos((prev) =>
                        mergeCalendarUpcoming(
                          nextDoses,
                          prev.filter((p) => p.kind === 'turno').map((p) => p.turno),
                          10
                        )
                      );
                    }}
                  />
                ) : (
                  <UpcomingTurnoCard
                    key={`turno-${item.turno.careLogId}`}
                    turno={item.turno}
                    muted
                    onPress={() => {
                      const day = dateKey(new Date(item.turno.inicio));
                      setSelectedDate(day);
                      const [y, mo] = day.split('-').map(Number);
                      setYear(y);
                      setMonth(mo - 1);
                      setMode('day');
                      router.push({
                        pathname: '/log/[id]',
                        params: { id: item.turno.careLogId },
                      });
                    }}
                  />
                )
              )
            )}
          </ScrollView>
        </View>
        </View>

        <FloatingActionButton label="Registro" onPress={() => router.push('/registro')} bottomOffset={56} />

        <CalendarAddEventModal
          visible={addEventSlot != null}
          timeLabel={addEventSlot ? `${addEventSlot} · ${formatDayShort(selectedDate)}` : ''}
          onClose={() => setAddEventSlot(null)}
          onPick={openRegistroFromSlot}
        />
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
