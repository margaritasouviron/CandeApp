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
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { EventCard } from '../../components/EventCard';
import { fetchDayEvents, type DayEvent } from '../../lib/careEvents';
import { EVENT_LABELS, type EventType } from '../../lib/eventTypes';
import { getPatient } from '../../lib/patientContext';
import { useAuth } from '../../lib/auth';
import { BackButton } from '../../components/BackButton';
import { Screen } from '../../lib/screen';
import { colors } from '../../lib/theme';

function formatDateHeader(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function DayDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<DayEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    try {
      const patient = await getPatient();
      if (!patient) return;
      setEvents(await fetchDayEvents(patient.id, date));
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  if (authLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.blue} style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  if (!session) return <Redirect href="/login" />;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return (
      <Screen>
        <Text style={styles.error}>Fecha inválida</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <BackButton />
        <Text style={styles.title}>{formatDateHeader(date)}</Text>

        {loading ? (
          <ActivityIndicator color={colors.blue} style={{ marginTop: 24 }} />
        ) : events.length === 0 ? (
          <Text style={styles.empty}>Sin eventos este día</Text>
        ) : (
          events.map((ev, i) => (
            <EventCard
              key={`${ev.referencia_id}-${i}`}
              tipo={ev.tipo_evento}
              time={ev.hora?.slice(0, 5) ?? '--:--'}
              title={ev.descripcion}
              subtitle={EVENT_LABELS[ev.tipo_evento as EventType] ?? ev.tipo_evento}
            />
          ))
        )}

        <Pressable
          style={styles.addBtn}
          onPress={() => router.push({ pathname: '/registro', params: { date } })}
        >
          <Text style={styles.addBtnText}>Agregar evento</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: Platform.OS === 'web' ? 32 : 40 },
  back: { marginBottom: 8 },
  backText: { color: colors.blue, fontWeight: '600', fontSize: 16 },
  title: { fontSize: 22, fontWeight: '700', color: colors.blueDark, marginBottom: 20, textTransform: 'capitalize' },
  empty: { color: colors.textMuted, fontSize: 15 },
  error: { padding: 20, color: colors.error },
  addBtn: {
    marginTop: 24,
    backgroundColor: colors.blue,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addBtnText: { color: colors.white, fontSize: 17, fontWeight: '700' },
});
