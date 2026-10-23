import { useCallback, useEffect, useState } from 'react';
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
import { fetchDoseReminders, formatDoseTime, registroParamsFromDose, type UpcomingDose } from '../../lib/medicationSchedules';
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
              <EventCard
                key={log.id}
                plain
                tipo={log.tipo}
                time={formatTime(log.registrado_en)}
                title={log.detail || EVENT_LABELS[log.tipo]}
              />
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
  linkMore: {
    fontFamily: fonts.bodySemi,
    color: colors.pinkDeep,
    fontSize: 14,
    marginTop: 16,
    marginBottom: 8,
  },
});
