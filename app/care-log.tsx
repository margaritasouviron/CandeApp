import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';

const TIPOS = ['comida', 'medicacion', 'observacion', 'nota'] as const;
type Tipo = (typeof TIPOS)[number];

const TIPO_LABELS: Record<Tipo, string> = {
  comida: 'Comida',
  medicacion: 'Medicación',
  observacion: 'Observación',
  nota: 'Nota',
};

type CareLogRow = {
  id: string;
  tipo: string;
  registrado_en: string;
};

export default function CareLogScreen() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tipo, setTipo] = useState<Tipo>('observacion');
  const [contenido, setContenido] = useState('');
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<CareLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('care_logs')
      .select('id, tipo, registrado_en')
      .order('registrado_en', { ascending: false })
      .limit(20);
    setLogs(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (session) loadLogs();
  }, [session, loadLogs]);

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

  const handleSave = async () => {
    if (!contenido.trim()) {
      Alert.alert('Error', 'Escribe una descripción');
      return;
    }

    setSaving(true);
    try {
      const { data: patient } = await supabase.from('patient').select('id').limit(1).maybeSingle();
      if (!patient) {
        Alert.alert('Error', 'No hay paciente configurado en Supabase');
        return;
      }

      const { data: log, error: logError } = await supabase
        .from('care_logs')
        .insert({
          patient_id: patient.id,
          tipo,
          registrado_por: session.user.id,
        })
        .select('id')
        .single();

      if (logError) throw logError;

      if (tipo === 'comida') {
        await supabase.from('meal_entries').insert({
          care_log_id: log.id,
          tipo_comida: 'otro',
          descripcion: contenido.trim(),
        });
      } else if (tipo === 'medicacion') {
        await supabase.from('medication_administrations').insert({
          care_log_id: log.id,
          nombre_medicamento: contenido.trim(),
          dosis: '—',
        });
      } else {
        await supabase.from('observations').insert({
          care_log_id: log.id,
          contenido: contenido.trim(),
        });
      }

      setContenido('');
      await loadLogs();
      Alert.alert('Guardado', 'Registro creado correctamente');
    } catch {
      Alert.alert('Error', 'No se pudo guardar el registro');
    } finally {
      setSaving(false);
    }
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Volver</Text>
        </Pressable>
        <Text style={styles.title}>Bitácora</Text>
      </View>

      <Text style={styles.label}>Tipo</Text>
      <View style={styles.chips}>
        {TIPOS.map((t) => (
          <Pressable
            key={t}
            onPress={() => setTipo(t)}
            style={[styles.chip, tipo === t && styles.chipActive]}
          >
            <Text style={[styles.chipText, tipo === t && styles.chipTextActive]}>{TIPO_LABELS[t]}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Descripción</Text>
      <TextInput
        style={styles.textArea}
        value={contenido}
        onChangeText={setContenido}
        multiline
        numberOfLines={4}
        placeholder="Describe el cuidado registrado…"
        placeholderTextColor={colors.textMuted}
      />

      <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.saveBtnText}>Guardar registro</Text>
        )}
      </Pressable>

      <Text style={styles.sectionTitle}>Registros recientes</Text>
      {loading ? (
        <ActivityIndicator color={colors.blue} />
      ) : logs.length === 0 ? (
        <Text style={styles.empty}>Sin registros</Text>
      ) : (
        logs.map((log) => (
          <View key={log.id} style={styles.logRow}>
            <Text style={styles.logTipo}>{TIPO_LABELS[log.tipo as Tipo] ?? log.tipo}</Text>
            <Text style={styles.logDate}>{formatDateTime(log.registrado_en)}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  topBar: { marginBottom: 20 },
  backBtn: { marginBottom: 8 },
  backText: { color: colors.blue, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '700', color: colors.blueDark },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8, marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.brownLight,
  },
  chipActive: { backgroundColor: colors.blue },
  chipText: { color: colors.brown, fontWeight: '600', fontSize: 14 },
  chipTextActive: { color: colors.white },
  textArea: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.white,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: colors.blue,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 28,
  },
  saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: 12 },
  empty: { color: colors.textMuted },
  logRow: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logTipo: { fontWeight: '600', color: colors.text, fontSize: 15 },
  logDate: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
});
