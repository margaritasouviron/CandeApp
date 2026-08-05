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
import { HomeTile } from '../../components/HomeTile';
import { TabHeader } from '../../components/TabHeader';
import { UpcomingDoseCard } from '../../components/UpcomingDoseCard';
import { fetchDoseReminders, registroParamsFromDose, type UpcomingDose } from '../../lib/medicationSchedules';
import { removeDoseAndFollowingFromList } from '../../lib/upcomingDoseActions';
import { getPatient } from '../../lib/patientContext';
import { Screen } from '../../lib/screen';
import { colors } from '../../lib/theme';

export default function HomeScreen() {
  const { session, signOut, role } = useAuth();
  const router = useRouter();
  const [patientName, setPatientName] = useState<string | null>(null);
  const [reminders, setReminders] = useState<UpcomingDose[]>([]);
  const [loading, setLoading] = useState(true);

  const isOrganizador = role === 'organizador';

  const loadData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const patient = await getPatient();
      setPatientName(patient?.nombre ?? null);
      setReminders(patient ? await fetchDoseReminders(patient.id, 12) : []);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const confirmDose = (dose: UpcomingDose) => {
    router.push({ pathname: '/registro', params: registroParamsFromDose(dose) });
  };

  return (
    <Screen>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={colors.blue} />}
      >
        <View style={styles.topRow}>
          <TabHeader title="Home" subtitle={patientName ? `Paciente: ${patientName}` : session?.user.email} />
          <Pressable onPress={signOut} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Salir</Text>
          </Pressable>
        </View>

        {reminders.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Medicación en las próximas horas</Text>
            {reminders.map((dose) => (
              <View key={dose.id} style={styles.reminderWrap}>
                <UpcomingDoseCard
                  dose={dose}
                  showConfirm
                  onConfirm={() => confirmDose(dose)}
                  showDelete={isOrganizador}
                  onDeleted={() => setReminders((prev) => removeDoseAndFollowingFromList(prev, dose))}
                />
              </View>
            ))}
          </>
        )}

        <View style={{ paddingHorizontal: 20 }}>
          <HomeTile label="Informe" onPress={() => router.push('/(tabs)/stats')} />
          <HomeTile label="Agregar registro" onPress={() => router.push('/registro')} variant="secondary" />
          <HomeTile label="Ver registro diario" onPress={() => router.push('/(tabs)/bitacora')} />
          <HomeTile label="Stock" onPress={() => router.push('/(tabs)/stock')} variant="secondary" />
          <HomeTile label="Stats" onPress={() => router.push('/(tabs)/stats')} />
        </View>

        {loading && reminders.length === 0 && (
          <ActivityIndicator color={colors.blue} style={{ marginTop: 24 }} />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: Platform.OS === 'web' ? 32 : 24 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingRight: 12 },
  logoutBtn: { padding: 16 },
  logoutText: { color: colors.blue, fontWeight: '600' },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: colors.text, marginHorizontal: 20, marginBottom: 12 },
  reminderWrap: { marginHorizontal: 20, marginBottom: 0 },
});
