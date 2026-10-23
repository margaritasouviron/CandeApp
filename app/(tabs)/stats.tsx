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
import { SleepWeekChart } from '../../components/SleepWeekChart';
import { getPatient } from '../../lib/patientContext';
import { Screen } from '../../lib/screen';
import { buildMedicalReport, fetchStats, type StatsSummary } from '../../lib/stats';
import { fetchWeeklySleepStats } from '../../lib/sleepStats';
import { EVENT_LABELS, type EventType } from '../../lib/eventTypes';
import { colors } from '../../lib/theme';
import { fonts } from '../../lib/typography';

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
  const [sleepAvg, setSleepAvg] = useState(0);
  const [sleepDays, setSleepDays] = useState<Awaited<ReturnType<typeof fetchWeeklySleepStats>>['days']>([]);
  const [patientName, setPatientName] = useState('Paciente');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const patient = await getPatient();
      if (!patient) return;
      setPatientName(patient.nombre);
      const [s, sleep] = await Promise.all([
        fetchStats(patient.id),
        fetchWeeklySleepStats(patient.id),
      ]);
      setStats(s);
      setSleepDays(sleep.days);
      setSleepAvg(sleep.averageHours);
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
          <ActivityIndicator color={colors.greenDark} style={{ marginTop: 32 }} />
        ) : !stats ? (
          <Text style={styles.empty}>Sin datos de paciente</Text>
        ) : (
          <>
            <Text style={styles.section}>Sueño (últimos 7 días)</Text>
            <SleepWeekChart days={sleepDays} averageHours={sleepAvg} />

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
  section: {
    fontFamily: fonts.title,
    fontSize: 17,
    color: colors.text,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
  },
  barRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 10, gap: 8 },
  barLabel: { width: 90, fontFamily: fonts.body, fontSize: 13, color: colors.text },
  barTrack: { flex: 1, height: 12, backgroundColor: colors.pink, borderRadius: 6, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.green, borderRadius: 6 },
  barCount: { width: 24, textAlign: 'right', fontFamily: fonts.bodySemi, color: colors.textMuted },
  empty: { fontFamily: fonts.body, color: colors.textMuted, paddingHorizontal: 20, marginTop: 8 },
  reportBtn: {
    marginHorizontal: 20,
    marginTop: 28,
    marginBottom: 12,
    backgroundColor: colors.pinkDeep,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  reportBtnText: { fontFamily: fonts.title, color: colors.white, fontSize: 16 },
});
