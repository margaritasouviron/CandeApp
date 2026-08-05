import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import { TabHeader } from '../../components/TabHeader';
import { getPatient } from '../../lib/patientContext';
import { Screen } from '../../lib/screen';
import { buildMedicalReport, fetchStats, type StatsSummary } from '../../lib/stats';
import { EVENT_LABELS, type EventType } from '../../lib/eventTypes';
import { colors } from '../../lib/theme';

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockLabel}>{label}</Text>
      <Text style={styles.blockValue}>{value}</Text>
    </View>
  );
}

function BarRow({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.barCount}>{count}</Text>
    </View>
  );
}

export default function StatsScreen() {
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [patientName, setPatientName] = useState('Paciente');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const patient = await getPatient();
      if (!patient) return;
      setPatientName(patient.nombre);
      setStats(await fetchStats(patient.id));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const generateReport = () => {
    if (!stats) return;
    const text = buildMedicalReport(patientName, stats);
    Alert.alert('Informe médico', text, [{ text: 'OK' }], { cancelable: true });
  };

  const maxCat = stats ? Math.max(...Object.values(stats.byCategory), 1) : 1;
  const maxMed = stats ? Math.max(...stats.medsPerDay.map((m) => m.count), 1) : 1;

  return (
    <Screen>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TabHeader title="Estadísticas" subtitle="Resumen del mes" />

        {loading ? (
          <ActivityIndicator color={colors.blue} style={{ marginTop: 32 }} />
        ) : !stats ? (
          <Text style={styles.empty}>Sin datos de paciente</Text>
        ) : (
          <>
            <View style={styles.row}>
              <StatBlock label="Esta semana" value={stats.weekEvents} />
              <StatBlock label="Este mes" value={stats.monthEvents} />
            </View>

            <Text style={styles.section}>Eventos por categoría</Text>
            {Object.entries(stats.byCategory).map(([k, v]) => (
              <BarRow key={k} label={EVENT_LABELS[k as EventType] ?? k} count={v} max={maxCat} />
            ))}

            <Text style={styles.section}>Tipos de comida</Text>
            {Object.keys(stats.foodTypes).length === 0 ? (
              <Text style={styles.empty}>Sin registros de comida</Text>
            ) : (
              Object.entries(stats.foodTypes).map(([k, v]) => (
                <BarRow key={k} label={k} count={v} max={Math.max(...Object.values(stats.foodTypes), 1)} />
              ))
            )}

            <Text style={styles.section}>Medicamentos por día</Text>
            {stats.medsPerDay.length === 0 ? (
              <Text style={styles.empty}>Sin medicación este mes</Text>
            ) : (
              stats.medsPerDay.map((m) => (
                <BarRow key={m.date} label={m.date.slice(5)} count={m.count} max={maxMed} />
              ))
            )}

            <Pressable style={styles.reportBtn} onPress={generateReport}>
              <Text style={styles.reportBtnText}>Generar informe médico</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: Platform.OS === 'web' ? 32 : 24 },
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginBottom: 8 },
  block: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  blockLabel: { fontSize: 13, color: colors.textMuted },
  blockValue: { fontSize: 28, fontWeight: '700', color: colors.blue, marginTop: 4 },
  section: { fontSize: 17, fontWeight: '700', color: colors.text, marginHorizontal: 20, marginTop: 20, marginBottom: 12 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 10, gap: 8 },
  barLabel: { width: 90, fontSize: 13, color: colors.text },
  barTrack: { flex: 1, height: 12, backgroundColor: colors.brownLight, borderRadius: 6, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.blue, borderRadius: 6 },
  barCount: { width: 24, textAlign: 'right', fontWeight: '700', color: colors.textMuted },
  empty: { color: colors.textMuted, paddingHorizontal: 20, marginTop: 8 },
  reportBtn: {
    marginHorizontal: 20,
    marginTop: 28,
    backgroundColor: colors.blue,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  reportBtnText: { color: colors.white, fontSize: 17, fontWeight: '700' },
});
