import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import {
  fetchMedicationAlerts,
  markAlertRead,
  refreshMedicationAlerts,
  resolveAlertDetails,
  type MedicationAlert,
} from '../lib/medicationAlerts';
import { Screen } from '../lib/screen';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';

type CareLogRow = {
  id: string;
  tipo: string;
  registrado_en: string;
  medNombre?: string;
  medDosis?: string;
};

type PatientRow = {
  nombre: string;
};

function alertBadgeLabel(tipo: string) {
  switch (tipo) {
    case 'nueva_medicacion':
      return 'Nueva medicación';
    case 'medicacion_proxima':
      return 'Próxima dosis';
    case 'dosis_omitida':
      return 'Dosis retrasada';
    default:
      return 'Medicación';
  }
}

function MedicationAlertCard({
  alert,
  onDismiss,
}: {
  alert: MedicationAlert;
  onDismiss: (id: string) => void;
}) {
  const { nombre, dosis, horario } = resolveAlertDetails(alert);

  return (
    <View style={styles.alertCard}>
      <View style={styles.alertHeader}>
        <Text style={styles.alertBadge}>{alertBadgeLabel(alert.tipo)}</Text>
        <Pressable onPress={() => onDismiss(alert.id)} hitSlop={8}>
          <Text style={styles.alertDismiss}>✕</Text>
        </Pressable>
      </View>
      <Text style={styles.alertNombre}>{nombre}</Text>
      <Text style={styles.alertLine}>
        <Text style={styles.alertLabel}>Dosis: </Text>
        {dosis}
      </Text>
      <Text style={styles.alertLine}>
        <Text style={styles.alertLabel}>Horario: </Text>
        {horario}
      </Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { session, signOut, loading: authLoading } = useAuth();
  const router = useRouter();
  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [logs, setLogs] = useState<CareLogRow[]>([]);
  const [alerts, setAlerts] = useState<MedicationAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      await refreshMedicationAlerts();

      const { data: patientData } = await supabase.from('patient').select('nombre').limit(1).maybeSingle();
      setPatient(patientData);

      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

      const [{ data: logData }, alertData] = await Promise.all([
        supabase
          .from('care_logs')
          .select(`
            id,
            tipo,
            registrado_en,
            medication_administrations (nombre_medicamento, dosis)
          `)
          .gte('registrado_en', start)
          .lt('registrado_en', end)
          .order('registrado_en', { ascending: false })
          .limit(10),
        fetchMedicationAlerts(session.user.id),
      ]);

      setLogs(
        (logData ?? []).map((row) => {
          const med = Array.isArray(row.medication_administrations)
            ? row.medication_administrations[0]
            : row.medication_administrations;
          return {
            id: row.id,
            tipo: row.tipo,
            registrado_en: row.registrado_en,
            medNombre: med?.nombre_medicamento,
            medDosis: med?.dosis,
          };
        })
      );
      setAlerts(alertData);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) loadData();
  }, [session, loadData]);

  const dismissAlert = async (id: string) => {
    await markAlertRead(id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

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
    <Screen>
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

        {alerts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Alertas de medicación</Text>
            {alerts.map((alert) => (
              <MedicationAlertCard key={alert.id} alert={alert} onDismiss={dismissAlert} />
            ))}
          </>
        )}

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
              <Text style={styles.eventText}>
                •{' '}
                {log.tipo === 'medicacion' && log.medNombre
                  ? `${log.medNombre}${log.medDosis ? ` (${log.medDosis})` : ''}`
                  : tipoLabel[log.tipo] ?? log.tipo}
              </Text>
            </View>
          ))
        )}

        <Pressable style={[styles.fab, Platform.OS === 'web' && styles.fabWeb]} onPress={() => router.push('/care-log')}>
          <Text style={styles.fabText}>+ Bitácora</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: Platform.OS === 'web' ? 32 : 100 },
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
  alertCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: colors.blue,
  },
  alertHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  alertBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.blue,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  alertDismiss: { fontSize: 18, color: colors.textMuted, paddingHorizontal: 4 },
  alertNombre: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 },
  alertLine: { fontSize: 15, color: colors.text, marginBottom: 4 },
  alertLabel: { fontWeight: '600', color: colors.blueDark },
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
  fabWeb: {
    position: 'relative',
    bottom: undefined,
    right: undefined,
    left: undefined,
    marginTop: 24,
    marginBottom: 8,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null),
  },
  fabText: { color: colors.white, fontSize: 17, fontWeight: '700' },
});
