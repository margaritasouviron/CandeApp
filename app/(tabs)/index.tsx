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
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { NavChip } from '../../components/NavChip';
import { TabHeader } from '../../components/TabHeader';
import { EventCard } from '../../components/EventCard';
import { FloatingActionButton } from '../../components/FloatingActionButton';
import { fetchRecentLogs } from '../../lib/careEvents';
import { EVENT_LABELS } from '../../lib/eventTypes';
import {
  fetchDoseReminders,
  formatDoseTime,
  getUrgentMedicationDose,
  medicationUrgencyBannerText,
  registroParamsFromDose,
  type UpcomingDose,
} from '../../lib/medicationSchedules';
import { getPatient } from '../../lib/patientContext';
import { Screen } from '../../lib/screen';
import { colors } from '../../lib/theme';
import { fonts } from '../../lib/typography';

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
}: {
  dose: UpcomingDose;
  onPress: () => void;
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
  const { session, signOut } = useAuth();
  const router = useRouter();
  const [patientName, setPatientName] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [reminders, setReminders] = useState<UpcomingDose[]>([]);
  const [recent, setRecent] = useState<Awaited<ReturnType<typeof fetchRecentLogs>>>([]);
  const [loading, setLoading] = useState(true);
  const [urgencyTick, setUrgencyTick] = useState(0);

  const loadData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const patient = await getPatient();
      setPatientName(patient?.nombre ?? null);
      setPatientId(patient?.id ?? null);
      if (patient) {
        const [doses, logs] = await Promise.all([
          fetchDoseReminders(patient.id, 12),
          fetchRecentLogs(8, undefined, patient.id),
        ]);
        setReminders(doses);
        setRecent(logs);
      } else {
        setReminders([]);
        setRecent([]);
      }
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const timer = setInterval(() => setUrgencyTick((n) => n + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  const urgentDose = useMemo(
    () => getUrgentMedicationDose(reminders),
    // urgencyTick: recalcular al cruzar el umbral de 1 h sin recargar datos
    [reminders, urgencyTick]
  );

  return (
    <Screen>
      <View style={styles.flex}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={colors.greenDark} />}
        >
          <View style={styles.topRow}>
            <TabHeader title="Home" subtitle={patientName ? `Paciente: ${patientName}` : session?.user.email} />
            <Pressable onPress={signOut} hitSlop={8}>
              <Text style={styles.logoutText}>Salir</Text>
            </Pressable>
          </View>

          <View style={styles.navRow}>
            <NavChip label="Calendario" variant="magenta" onPress={() => router.push('/(tabs)/calendar')} />
            <NavChip label="Stats" variant="blush" onPress={() => router.push('/(tabs)/stats')} />
            <NavChip label="Stock" variant="mint" onPress={() => router.push('/(tabs)/stock')} />
          </View>
          <NavChip label="Estudios" variant="rose" layout="solo" onPress={() => router.push('/estudios')} />

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

          <Text style={styles.sectionTitle}>Próximos eventos</Text>
          {reminders.length === 0 ? (
            <Text style={styles.empty}>Sin medicaciones programadas pronto</Text>
          ) : (
            reminders.slice(0, 4).map((dose) => (
              <HomeUpcomingLine
                key={dose.id}
                dose={dose}
                onPress={() => router.push({ pathname: '/registro', params: registroParamsFromDose(dose) })}
              />
            ))
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  content: { paddingBottom: Platform.OS === 'web' ? 120 : 140, paddingHorizontal: 20 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logoutText: { fontFamily: fonts.bodySemi, color: colors.pinkDeep, fontSize: 14, paddingTop: 16 },
  navRow: { flexDirection: 'row', marginTop: 4, marginHorizontal: -4 },
  medAlert: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.error,
    backgroundColor: '#FFF5F5',
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
