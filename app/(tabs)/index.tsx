import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { NavChip } from '../../components/NavChip';
import { TabHeader } from '../../components/TabHeader';
import { EventCard } from '../../components/EventCard';
import { FloatingActionButton } from '../../components/FloatingActionButton';
import { fetchRecentLogs } from '../../lib/careEvents';
import { EVENT_LABELS } from '../../lib/eventTypes';
import { fetchActiveSleepSession, formatSleepClock } from '../../lib/sleepSession';
import {
  fetchDoseReminders,
  formatDoseTime,
  getUrgentMedicationDose,
  medicationUrgencyBannerText,
  registroParamsFromDose,
  type UpcomingDose,
} from '../../lib/medicationSchedules';
import { fetchInventoryAlerts, type InventoryItem } from '../../lib/inventory';
import {
  fetchUpcomingMedicalTurnos,
  filterTurnosNeedingPrep,
  formatTurnoClock,
  formatTurnoDateTime,
  medicalTurnoPrepMessage,
  type MedicalTurno,
} from '../../lib/medicalAppointments';
import { getPatient } from '../../lib/patientContext';
import { Screen } from '../../lib/screen';
import { useAppColors } from '../../lib/ThemeModeProvider';
import { fonts } from '../../lib/typography';
import type { AppColors } from '../../lib/theme';

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function HomeUpcomingLine({
  dose,
  onPress,
  styles,
}: {
  dose: UpcomingDose;
  onPress: () => void;
  styles: ReturnType<typeof createHomeStyles>;
}) {
  return (
    <Pressable onPress={onPress} style={styles.plainRow}>
      <View style={styles.plainDot} />
      <View style={styles.plainBody}>
        <Text style={styles.plainTime}>{formatDoseTime(dose.programadoPara)}</Text>
        <Text style={styles.plainTitle}>{dose.nombre}</Text>
        <Text style={styles.plainMeta}>Medicación programada</Text>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { session, signOut, role, profile } = useAuth();
  const router = useRouter();
  const colors = useAppColors();
  const styles = useMemo(() => createHomeStyles(colors), [colors]);
  const [patientName, setPatientName] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [reminders, setReminders] = useState<UpcomingDose[]>([]);
  const [recent, setRecent] = useState<Awaited<ReturnType<typeof fetchRecentLogs>>>([]);
  const [loading, setLoading] = useState(true);
  const [urgencyTick, setUrgencyTick] = useState(0);
  const [activeSleep, setActiveSleep] = useState<Awaited<ReturnType<typeof fetchActiveSleepSession>>>(null);
  const [stockAlerts, setStockAlerts] = useState<{ item: InventoryItem; status: 'low' | 'near' }[]>([]);
  const [upcomingTurnos, setUpcomingTurnos] = useState<MedicalTurno[]>([]);

  const loadData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const patient = await getPatient();
      setPatientName(patient?.nombre ?? null);
      setPatientId(patient?.id ?? null);
      if (patient) {
        const [dosesR, logsR, sleepR, alertsR, turnosR] = await Promise.allSettled([
          fetchDoseReminders(patient.id, 12),
          fetchRecentLogs(8, undefined, patient.id),
          fetchActiveSleepSession(patient.id),
          fetchInventoryAlerts(patient.id),
          fetchUpcomingMedicalTurnos(patient.id, 120),
        ]);
        setReminders(dosesR.status === 'fulfilled' ? dosesR.value : []);
        setRecent(logsR.status === 'fulfilled' ? logsR.value : []);
        setActiveSleep(sleepR.status === 'fulfilled' ? sleepR.value : null);
        setUpcomingTurnos(turnosR.status === 'fulfilled' ? turnosR.value : []);
        const alerts = alertsR.status === 'fulfilled' ? alertsR.value : [];
        setStockAlerts(
          alerts
            .filter((a) => a.status === 'low' || a.status === 'near')
            .slice(0, 5) as { item: InventoryItem; status: 'low' | 'near' }[]
        );
      } else {
        setReminders([]);
        setRecent([]);
        setStockAlerts([]);
        setUpcomingTurnos([]);
      }
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const refreshTurnoPrep = useCallback(async () => {
    if (!patientId) return;
    try {
      const turnos = await fetchUpcomingMedicalTurnos(patientId, 120);
      setUpcomingTurnos(turnos);
    } catch {
      /* mantener lista previa */
    }
  }, [patientId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setUrgencyTick((n) => n + 1);
      void refreshTurnoPrep();
    }, 60_000);
    return () => clearInterval(timer);
  }, [refreshTurnoPrep]);

  const urgentDose = useMemo(
    () => getUrgentMedicationDose(reminders),
    // urgencyTick: recalcular al cruzar el umbral de 1 h sin recargar datos
    [reminders, urgencyTick]
  );

  const nextTurnoPrep = useMemo(() => {
    void urgencyTick;
    return filterTurnosNeedingPrep(upcomingTurnos, 2)[0] ?? null;
  }, [upcomingTurnos, urgencyTick]);

  const homeUpcomingTurnos = useMemo(() => {
    const now = Date.now();
    return upcomingTurnos.filter((t) => new Date(t.fin).getTime() > now).slice(0, 4);
  }, [upcomingTurnos]);

  return (
    <Screen>
      <View style={styles.flex}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={colors.greenDark} />}
        >
          <View style={styles.topRow}>
            <TabHeader
              title="Home"
              subtitle={
                patientName
                  ? `Paciente: ${patientName} · ${profile?.nombre_completo ?? 'Usuario'}`
                  : profile?.nombre_completo ?? 'Usuario'
              }
            />
            <View style={styles.topActions}>
              {role === 'organizador' ? (
                <Pressable onPress={() => router.push('/settings')} hitSlop={8}>
                  <Text style={styles.settingsText}>Settings</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={signOut} hitSlop={8}>
                <Text style={styles.logoutText}>Salir</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.navRow}>
            <NavChip label="Calendario" variant="magenta" onPress={() => router.push('/(tabs)/calendar')} />
            <NavChip label="Stats" variant="blush" onPress={() => router.push('/(tabs)/stats')} />
            <NavChip label="Stock" variant="mint" onPress={() => router.push('/(tabs)/stock')} />
          </View>
          <NavChip label="Estudios" variant="rose" layout="solo" onPress={() => router.push('/estudios')} />

          <Pressable
            style={[styles.sleepShortcut, activeSleep && styles.sleepShortcutActive]}
            onPress={() =>
              router.push({
                pathname: '/registro',
                params: { tipo: 'sueno', sleepShortcut: '1' },
              })
            }
          >
            <Text style={styles.sleepShortcutTitle}>
              {activeSleep ? 'Cande dormida' : 'Sueño'}
            </Text>
            <Text style={styles.sleepShortcutSub}>
              {activeSleep
                ? `Desde ${formatSleepClock(activeSleep.inicio)} · Tocá para registrar despertar`
                : 'Tocá para registrar que se durmió'}
            </Text>
          </Pressable>

          {stockAlerts.length > 0 ? (
            <Pressable style={styles.stockAlert} onPress={() => router.push('/(tabs)/stock')}>
              <Text style={styles.stockAlertTitle}>Stock</Text>
              <Text style={styles.stockAlertText}>
                {stockAlerts.length === 1
                  ? `${stockAlerts[0].item.nombre} ${
                      stockAlerts[0].status === 'low' ? 'por debajo del umbral' : 'cerca de agotarse'
                    }`
                  : `${stockAlerts.length} insumos cerca de agotarse o bajo el umbral`}
              </Text>
              <Text style={styles.stockAlertAction}>Ver inventario →</Text>
            </Pressable>
          ) : null}

          {urgentDose ? (
            <Pressable
              style={styles.medAlert}
              onPress={() =>
                router.push({ pathname: '/registro', params: registroParamsFromDose(urgentDose) })
              }
            >
              <Text style={styles.medAlertTitle}>Medicación</Text>
              <Text style={styles.medAlertText}>{medicationUrgencyBannerText(urgentDose)}</Text>
              <Text style={styles.medAlertAction}>Registrar administración →</Text>
            </Pressable>
          ) : null}

          {nextTurnoPrep ? (
            <Pressable
              style={styles.turnoAlert}
              onPress={() => {
                const day = new Date(nextTurnoPrep.inicio);
                const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                router.push({
                  pathname: '/(tabs)/calendar',
                  params: { date },
                });
              }}
            >
              <Text style={styles.turnoAlertTitle}>Turno médico</Text>
              <Text style={styles.turnoAlertText}>{medicalTurnoPrepMessage(nextTurnoPrep)}</Text>
              <Text style={styles.turnoAlertMeta}>
                {formatTurnoClock(nextTurnoPrep.inicio)} · {nextTurnoPrep.direccion}
              </Text>
            </Pressable>
          ) : null}

          <Text style={styles.sectionTitle}>Próximos eventos</Text>
          {reminders.length === 0 && homeUpcomingTurnos.length === 0 ? (
            <Text style={styles.empty}>Sin medicaciones ni turnos programados pronto</Text>
          ) : (
            <>
              {homeUpcomingTurnos.map((turno) => (
                <Pressable
                  key={turno.careLogId}
                  onPress={() => router.push(`/log/${turno.careLogId}`)}
                  style={styles.plainRow}
                >
                  <View style={[styles.plainDot, { backgroundColor: '#6366F1' }]} />
                  <View style={styles.plainBody}>
                    <Text style={styles.plainTime}>{formatTurnoDateTime(turno.inicio)}</Text>
                    <Text style={styles.plainTitle}>{turno.nombreMedico}</Text>
                    <Text style={styles.plainMeta}>Turno médico · {turno.direccion}</Text>
                  </View>
                </Pressable>
              ))}
              {reminders.slice(0, 4).map((dose) => (
                <HomeUpcomingLine
                  key={dose.id}
                  dose={dose}
                  styles={styles}
                  onPress={() => router.push({ pathname: '/registro', params: registroParamsFromDose(dose) })}
                />
              ))}
            </>
          )}

          <Text style={styles.sectionTitle}>Últimos eventos</Text>
          {loading && recent.length === 0 ? (
            <ActivityIndicator color={colors.greenDark} style={{ marginTop: 16 }} />
          ) : recent.length === 0 ? (
            <Text style={styles.empty}>Todavía no hay registros</Text>
          ) : (
            recent.map((log) => (
              <Pressable key={log.id} onPress={() => router.push(`/log/${log.id}`)} style={styles.recentRow}>
                <EventCard
                  plain
                  tipo={log.tipo}
                  time={formatTime(log.registrado_en)}
                  title={log.detail || EVENT_LABELS[log.tipo]}
                  authorName={log.nurseName}
                />
              </Pressable>
            ))
          )}

          {patientId ? (
            <Pressable onPress={() => router.push('/(tabs)/calendar')} hitSlop={8}>
              <Text style={styles.linkMore}>Ver todo en el calendario →</Text>
            </Pressable>
          ) : null}
        </ScrollView>

        <FloatingActionButton label="Registro" onPress={() => router.push('/registro')} bottomOffset={56} />
      </View>
    </Screen>
  );
}

function createHomeStyles(colors: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    container: { flex: 1 },
    content: { paddingBottom: Platform.OS === 'web' ? 120 : 140, paddingHorizontal: 20 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    topActions: { flexDirection: 'row', gap: 12, paddingTop: 16 },
    settingsText: { fontFamily: fonts.bodySemi, color: colors.text, fontSize: 14 },
    logoutText: { fontFamily: fonts.bodySemi, color: colors.pinkDeep, fontSize: 14 },
    navRow: { flexDirection: 'row', marginTop: 4, marginHorizontal: -4 },
    sleepShortcut: {
      marginTop: 14,
      padding: 14,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: colors.green,
      backgroundColor: colors.upcomingFill,
    },
    sleepShortcutActive: {
      borderColor: colors.greenDark,
      backgroundColor: colors.sleepShade,
    },
    sleepShortcutTitle: { fontFamily: fonts.title, fontSize: 17, color: colors.greenDark },
    sleepShortcutSub: { fontFamily: fonts.body, fontSize: 13, color: colors.text, marginTop: 4, lineHeight: 18 },
    stockAlert: {
      marginTop: 16,
      padding: 14,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: colors.pinkStrong,
      backgroundColor: colors.brownLight,
    },
    stockAlertTitle: {
      fontFamily: fonts.title,
      fontSize: 15,
      color: colors.pinkDeep,
      marginBottom: 6,
    },
    stockAlertText: {
      fontFamily: fonts.bodySemi,
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    stockAlertAction: {
      fontFamily: fonts.bodySemi,
      fontSize: 13,
      color: colors.pinkDeep,
      marginTop: 10,
    },
    medAlert: {
      marginTop: 16,
      padding: 14,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: colors.error,
      backgroundColor: colors.brownLight,
    },
    medAlertTitle: {
      fontFamily: fonts.title,
      fontSize: 15,
      color: colors.error,
      marginBottom: 6,
    },
    medAlertText: {
      fontFamily: fonts.bodySemi,
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    medAlertAction: {
      fontFamily: fonts.bodySemi,
      fontSize: 13,
      color: colors.pinkDeep,
      marginTop: 10,
    },
    turnoAlert: {
      marginTop: 16,
      padding: 14,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: '#6366F1',
      backgroundColor: colors.brownLight,
    },
    turnoAlertTitle: {
      fontFamily: fonts.title,
      fontSize: 15,
      color: '#4338CA',
      marginBottom: 6,
    },
    turnoAlertText: {
      fontFamily: fonts.bodySemi,
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    turnoAlertMeta: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 8,
    },
    sectionTitle: {
      fontFamily: fonts.title,
      fontSize: 17,
      color: colors.text,
      marginTop: 20,
      marginBottom: 8,
    },
    empty: { fontFamily: fonts.body, color: colors.textMuted, marginBottom: 8 },
    plainRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 },
    plainDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.pinkStrong,
      marginTop: 6,
      marginRight: 10,
    },
    plainBody: { flex: 1 },
    plainTime: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textMuted },
    plainTitle: { fontFamily: fonts.title, fontSize: 15, color: colors.text, marginTop: 2 },
    plainMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.greenDark, marginTop: 2 },
    recentRow: { ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null) },
    linkMore: {
      fontFamily: fonts.bodySemi,
      color: colors.pinkDeep,
      fontSize: 14,
      marginTop: 16,
      marginBottom: 8,
    },
  });
}
