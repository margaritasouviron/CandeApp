import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';

type CareLogRow = {
  id: string;
  tipo: string;
  registrado_en: string;
};

type PatientRow = {
  nombre: string;
};

export default function DashboardScreen() {
  const { session, signOut, loading: authLoading } = useAuth();
  const router = useRouter();
  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [logs, setLogs] = useState<CareLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: patientData } = await supabase.from('patient').select('nombre').limit(1).maybeSingle();
      setPatient(patientData);

      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

      const { data: logData } = await supabase
        .from('care_logs')
        .select('id, tipo, registrado_en')
        .gte('registrado_en', start)
        .lt('registrado_en', end)
        .order('registrado_en', { ascending: false })
        .limit(10);

      setLogs(logData ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) loadData();
  }, [session, loadData]);

  if (authLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.blue} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const tipoLabel: Record<string, string> = {
    comida: 'Comida',
    medicacion: 'Medicación',
    signos_vitales: 'Signos vitales',
    higiene: 'Higiene',
    observacion: 'Observación',
    nota: 'Nota',
    otro: 'Otro',
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={colors.blue} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Resumen de hoy</Text>
          <Text style={styles.headerSub}>{session.user.email}</Text>
        </View>
        <Pressable onPress={signOut} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Salir</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Paciente</Text>
        <Text style={styles.cardValue}>{patient?.nombre ?? 'Sin datos'}</Text>
      </View>

      <Text style={styles.sectionTitle}>Eventos de hoy</Text>
      {loading && logs.length === 0 ? (
        <ActivityIndicator color={colors.blue} style={{ marginTop: 16 }} />
      ) : logs.length === 0 ? (
        <Text style={styles.empty}>Sin registros hoy</Text>
      ) : (
        logs.map((log) => (
          <View key={log.id} style={styles.eventRow}>
            <Text style={styles.eventTime}>{formatTime(log.registrado_en)}</Text>
            <Text style={styles.eventText}>• {tipoLabel[log.tipo] ?? log.tipo}</Text>
          </View>
        ))
      )}

      <Pressable style={styles.fab} onPress={() => router.push('/care-log')}>
        <Text style={styles.fabText}>+ Bitácora</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 100 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: colors.blueDark },
  headerSub: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  logoutBtn: { padding: 8 },
  logoutText: { color: colors.blue, fontWeight: '600' },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  cardLabel: { fontSize: 13, color: colors.textMuted },
  cardValue: { fontSize: 20, fontWeight: '600', color: colors.text, marginTop: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: 12 },
  empty: { color: colors.textMuted, fontSize: 15 },
  eventRow: { flexDirection: 'row', marginBottom: 10, gap: 8 },
  eventTime: { fontWeight: '600', color: colors.blue, width: 48 },
  eventText: { flex: 1, color: colors.text, fontSize: 15 },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    left: 24,
    backgroundColor: colors.blue,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  fabText: { color: colors.white, fontSize: 17, fontWeight: '700' },
});
