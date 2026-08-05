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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EventCard } from '../../components/EventCard';
import { TabHeader } from '../../components/TabHeader';
import { UpcomingDoseCard } from '../../components/UpcomingDoseCard';
import { useAuth } from '../../lib/auth';
import { fetchRecentLogs, type CareLogListItem } from '../../lib/careEvents';
import { EVENT_LABELS, EVENT_TYPES, type EventType } from '../../lib/eventTypes';
import { fetchUpcomingDoses, registroParamsFromDose, type UpcomingDose } from '../../lib/medicationSchedules';
import { removeDoseAndFollowingFromList } from '../../lib/upcomingDoseActions';
import { getPatient } from '../../lib/patientContext';
import { Screen } from '../../lib/screen';
import { colors } from '../../lib/theme';

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function BitacoraScreen() {
  const router = useRouter();
  const { role } = useAuth();
  const { saved, message } = useLocalSearchParams<{ saved?: string; message?: string }>();
  const [logs, setLogs] = useState<CareLogListItem[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingDose[]>([]);
  const [filter, setFilter] = useState<EventType | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const isOrganizador = role === 'organizador';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const patient = await getPatient();
      const tipoFilter = filter === 'all' ? undefined : [filter];
      setLogs(await fetchRecentLogs(40, tipoFilter));
      if (patient) {
        setUpcoming(await fetchUpcomingDoses(patient.id, 72));
      } else {
        setUpcoming([]);
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

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
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.blue} />}
      >
        <TabHeader title="Bitácora" subtitle="Registro diario de cuidados" />

        <Pressable style={styles.addBtn} onPress={() => router.push('/registro')}>
          <Text style={styles.addBtnText}>+ Agregar evento</Text>
        </Pressable>

        {toast ? (
          <View style={styles.toast}>
            <Text style={styles.toastText}>✓ {toast}</Text>
          </View>
        ) : null}

        <Text style={styles.filterLabel}>Filtrar por tipo</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Pressable
            style={[styles.chip, filter === 'all' && styles.chipOn]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.chipText, filter === 'all' && styles.chipTextOn]}>Todos</Text>
          </Pressable>
          {EVENT_TYPES.map((t) => (
            <Pressable
              key={t}
              style={[styles.chip, filter === t && styles.chipOn]}
              onPress={() => setFilter(t)}
            >
              <Text style={[styles.chipText, filter === t && styles.chipTextOn]}>{EVENT_LABELS[t]}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.section}>Próximos eventos</Text>
        {loading && upcoming.length === 0 ? (
          <ActivityIndicator color={colors.blue} style={styles.sectionLoader} />
        ) : upcoming.length === 0 ? (
          <Text style={styles.empty}>No hay medicaciones programadas</Text>
        ) : (
          <View style={styles.cardWrap}>
            {upcoming.map((dose) => (
              <UpcomingDoseCard
                key={dose.id}
                dose={dose}
                showConfirm
                onConfirm={() => confirmDose(dose)}
                showDelete={isOrganizador}
                onDeleted={() => setUpcoming((prev) => removeDoseAndFollowingFromList(prev, dose))}
              />
            ))}
          </View>
        )}

        <Pressable onPress={() => router.push('/(tabs)/calendar')}>
          <Text style={styles.calendarLink}>Ver calendario con todos los eventos →</Text>
        </Pressable>

        <Text style={styles.section}>Últimos eventos</Text>
        {loading && logs.length === 0 ? (
          <ActivityIndicator color={colors.blue} style={styles.sectionLoader} />
        ) : logs.length === 0 ? (
          <Text style={styles.empty}>Sin registros</Text>
        ) : (
          logs.map((log) => (
            <View key={log.id} style={styles.cardWrap}>
              <EventCard
                tipo={log.tipo}
                time={formatTime(log.registrado_en)}
                title={log.detail || EVENT_LABELS[log.tipo]}
                subtitle={log.nurseName ? `Por ${log.nurseName}` : undefined}
              />
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: Platform.OS === 'web' ? 32 : 24 },
  addBtn: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: colors.blue,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addBtnText: { color: colors.white, fontSize: 17, fontWeight: '700' },
  toast: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#dcfce7',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  toastText: { color: '#166534', fontWeight: '600', fontSize: 14 },
  filterLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginHorizontal: 20, marginBottom: 8 },
  chips: { paddingHorizontal: 20, gap: 8, paddingBottom: 16 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.brownLight,
  },
  chipOn: { backgroundColor: colors.blue },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.brown },
  chipTextOn: { color: colors.white },
  calendarLink: {
    color: colors.blue,
    fontWeight: '600',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  section: { fontSize: 17, fontWeight: '700', color: colors.text, marginHorizontal: 20, marginBottom: 12, marginTop: 4 },
  sectionLoader: { marginBottom: 12 },
  cardWrap: { paddingHorizontal: 20 },
  empty: { color: colors.textMuted, paddingHorizontal: 20, marginBottom: 8 },
});
