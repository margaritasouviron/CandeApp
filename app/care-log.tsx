import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import { Screen } from '../lib/screen';
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

type Prescription = {
  id: string;
  nombre: string;
  dosis_estandar: string;
  intervalo_horas: number;
};

const NEW_MED_ID = '__new__';

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export default function CareLogScreen() {
  const { session, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tipo, setTipo] = useState<Tipo>('observacion');
  const [contenido, setContenido] = useState('');
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<CareLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedMedId, setSelectedMedId] = useState<string | null>(null);
  const [dosis, setDosis] = useState('');
  const [newMedNombre, setNewMedNombre] = useState('');
  const [newMedDosisEstandar, setNewMedDosisEstandar] = useState('');
  const [newMedIntervalo, setNewMedIntervalo] = useState('8');

  const isOrganizador = role === 'organizador';
  const isNewMed = selectedMedId === NEW_MED_ID;
  const selectedPrescription = prescriptions.find((p) => p.id === selectedMedId) ?? null;

  const intervaloHoras = useMemo(() => {
    if (isNewMed) {
      const parsed = parseFloat(newMedIntervalo.replace(',', '.'));
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 8;
    }
    return selectedPrescription?.intervalo_horas ?? 8;
  }, [isNewMed, newMedIntervalo, selectedPrescription]);

  const proximaDosis = useMemo(() => addHours(new Date(), intervaloHoras), [intervaloHoras]);

  const loadPrescriptions = useCallback(async (pid: string) => {
    const { data } = await supabase
      .from('medication_prescriptions')
      .select('id, nombre, dosis_estandar, intervalo_horas')
      .eq('patient_id', pid)
      .eq('activo', true)
      .order('nombre');
    setPrescriptions(data ?? []);
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const { data: patient } = await supabase.from('patient').select('id').limit(1).maybeSingle();
    if (patient?.id) await loadPrescriptions(patient.id);

    const { data } = await supabase
      .from('care_logs')
      .select('id, tipo, registrado_en')
      .order('registrado_en', { ascending: false })
      .limit(20);
    setLogs(data ?? []);
    setLoading(false);
  }, [loadPrescriptions]);

  useEffect(() => {
    if (session) loadLogs();
  }, [session, loadLogs]);

  useEffect(() => {
    if (selectedPrescription && !isNewMed) {
      setDosis(selectedPrescription.dosis_estandar);
    }
  }, [selectedPrescription, isNewMed]);

  const selectMedication = (id: string) => {
    setSelectedMedId(id);
    setPickerOpen(false);
    if (id === NEW_MED_ID) {
      setDosis('');
      setNewMedNombre('');
      setNewMedDosisEstandar('');
      setNewMedIntervalo('8');
    } else {
      const rx = prescriptions.find((p) => p.id === id);
      if (rx) setDosis(rx.dosis_estandar);
    }
  };

  const pickerLabel = () => {
    if (!selectedMedId) return 'Seleccionar medicación';
    if (isNewMed) return 'Nueva medicación';
    return selectedPrescription?.nombre ?? 'Seleccionar medicación';
  };

  if (authLoading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.blue} />
        </View>
      </Screen>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  const saveMedication = async (pid: string) => {
    if (!selectedMedId) {
      Alert.alert('Error', 'Selecciona una medicación');
      return;
    }

    let prescriptionId: string | null = null;
    let nombreMedicamento: string;
    let dosisFinal: string;

    if (isNewMed) {
      if (!isOrganizador) {
        Alert.alert('Error', 'Solo la administradora puede agregar nuevas medicaciones');
        return;
      }
      if (!newMedNombre.trim()) {
        Alert.alert('Error', 'Escribe el nombre de la medicación');
        return;
      }
      if (!newMedDosisEstandar.trim()) {
        Alert.alert('Error', 'Escribe la dosis estándar');
        return;
      }

      const { data: rx, error: rxError } = await supabase
        .from('medication_prescriptions')
        .insert({
          patient_id: pid,
          nombre: newMedNombre.trim(),
          dosis_estandar: newMedDosisEstandar.trim(),
          intervalo_horas: intervaloHoras,
          hora_inicio: new Date().toTimeString().slice(0, 8),
          created_by: session.user.id,
        })
        .select('id, nombre, dosis_estandar')
        .single();

      if (rxError) {
        console.log('[care-log] prescription insert error:', rxError);
        Alert.alert('Error', rxError.message);
        return;
      }

      prescriptionId = rx.id;
      nombreMedicamento = rx.nombre;
      dosisFinal = dosis.trim() || rx.dosis_estandar;
      setPrescriptions((prev) => [
        ...prev,
        { id: rx.id, nombre: rx.nombre, dosis_estandar: rx.dosis_estandar, intervalo_horas: intervaloHoras },
      ]);
    } else {
      if (!selectedPrescription) return;
      prescriptionId = selectedPrescription.id;
      nombreMedicamento = selectedPrescription.nombre;
      dosisFinal = dosis.trim() || selectedPrescription.dosis_estandar;
    }

    if (!dosisFinal.trim()) {
      Alert.alert('Error', 'Indica la dosis administrada');
      return;
    }

    const administradoEn = new Date();
    const proxima = addHours(administradoEn, intervaloHoras);

    const { data: log, error: logError } = await supabase
      .from('care_logs')
      .insert({
        patient_id: pid,
        tipo: 'medicacion',
        registrado_por: session.user.id,
      })
      .select('id')
      .single();

    if (logError) throw logError;

    const { error: adminError } = await supabase.from('medication_administrations').insert({
      care_log_id: log.id,
      prescription_id: prescriptionId,
      nombre_medicamento: nombreMedicamento,
      dosis: dosisFinal.trim(),
      administrado_en: administradoEn.toISOString(),
      proxima_dosis_en: proxima.toISOString(),
    });

    if (adminError) throw adminError;

    if (prescriptionId) {
      await supabase.from('medication_schedules').insert({
        prescription_id: prescriptionId,
        patient_id: pid,
        programado_para: proxima.toISOString(),
        status: 'pendiente',
      });
    }

    setSelectedMedId(null);
    setDosis('');
    setNewMedNombre('');
    setNewMedDosisEstandar('');
    setNewMedIntervalo('8');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: patient } = await supabase.from('patient').select('id').limit(1).maybeSingle();
      if (!patient) {
        Alert.alert('Error', 'No hay paciente configurado en Supabase');
        return;
      }

      if (tipo === 'medicacion') {
        await saveMedication(patient.id);
      } else {
        if (!contenido.trim()) {
          Alert.alert('Error', 'Escribe una descripción');
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
        } else {
          await supabase.from('observations').insert({
            care_log_id: log.id,
            contenido: contenido.trim(),
          });
        }
        setContenido('');
      }

      await loadLogs();
      Alert.alert(
        'Guardado',
        tipo === 'medicacion'
          ? `Registro creado. Próxima dosis: ${formatDateTime(proximaDosis.toISOString())}`
          : 'Registro creado correctamente'
      );
    } catch (err) {
      console.log('[care-log] save error:', err);
      Alert.alert('Error', 'No se pudo guardar el registro');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
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

        {tipo === 'medicacion' ? (
          <View style={styles.medForm}>
            <Text style={styles.label}>Medicación</Text>
            <Pressable style={styles.select} onPress={() => setPickerOpen(true)}>
              <Text style={[styles.selectText, !selectedMedId && styles.selectPlaceholder]}>{pickerLabel()}</Text>
              <Text style={styles.selectChevron}>▼</Text>
            </Pressable>

            {isNewMed && (
              <>
                <Text style={styles.label}>Nombre de la medicación</Text>
                <TextInput
                  style={styles.input}
                  value={newMedNombre}
                  onChangeText={setNewMedNombre}
                  placeholder="Ej. Paracetamol"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.label}>Dosis estándar (perfil administrador)</Text>
                <TextInput
                  style={styles.input}
                  value={newMedDosisEstandar}
                  onChangeText={setNewMedDosisEstandar}
                  placeholder="Ej. 500 mg"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.label}>Intervalo hasta próxima dosis (horas)</Text>
                <TextInput
                  style={styles.input}
                  value={newMedIntervalo}
                  onChangeText={setNewMedIntervalo}
                  keyboardType="decimal-pad"
                  placeholder="8"
                  placeholderTextColor={colors.textMuted}
                />
              </>
            )}

            <Text style={styles.label}>Dosis administrada</Text>
            <TextInput
              style={styles.input}
              value={dosis}
              onChangeText={setDosis}
              placeholder="Ej. 500 mg"
              placeholderTextColor={colors.textMuted}
            />

            {selectedMedId && (
              <View style={styles.nextDoseBox}>
                <Text style={styles.nextDoseLabel}>Próxima medicación</Text>
                <Text style={styles.nextDoseValue}>{formatDateTime(proximaDosis.toISOString())}</Text>
                <Text style={styles.nextDoseHint}>
                  Cada {intervaloHoras} h según el perfil del paciente
                </Text>
              </View>
            )}
          </View>
        ) : (
          <>
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
          </>
        )}

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

      <Modal visible={pickerOpen} transparent animationType="slide">
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Medicación del paciente</Text>
            <FlatList
              data={
                isOrganizador
                  ? [...prescriptions, { id: NEW_MED_ID, nombre: '+ Agregar nueva medicación', dosis_estandar: '', intervalo_horas: 0 }]
                  : prescriptions
              }
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable style={styles.modalRow} onPress={() => selectMedication(item.id)}>
                  <Text style={[styles.modalRowText, item.id === NEW_MED_ID && styles.modalRowNew]}>
                    {item.nombre}
                  </Text>
                  {item.id !== NEW_MED_ID && (
                    <Text style={styles.modalRowSub}>
                      {item.dosis_estandar} · cada {item.intervalo_horas} h
                    </Text>
                  )}
                </Pressable>
              )}
              ListEmptyComponent={
                isOrganizador ? (
                  <Pressable style={styles.modalRow} onPress={() => selectMedication(NEW_MED_ID)}>
                    <Text style={[styles.modalRowText, styles.modalRowNew]}>+ Agregar nueva medicación</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.emptyPicker}>No hay medicaciones configuradas. Pide a la administradora que las agregue.</Text>
                )
              }
            />
            <Pressable style={styles.modalClose} onPress={() => setPickerOpen(false)}>
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  medForm: { marginBottom: 4 },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: colors.white,
  },
  selectText: { fontSize: 16, color: colors.text, flex: 1 },
  selectPlaceholder: { color: colors.textMuted },
  selectChevron: { color: colors.textMuted, fontSize: 12, marginLeft: 8 },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.white,
    marginBottom: 4,
  },
  nextDoseBox: {
    marginTop: 12,
    backgroundColor: colors.brownLight,
    borderRadius: 14,
    padding: 14,
  },
  nextDoseLabel: { fontSize: 13, color: colors.brown, fontWeight: '600' },
  nextDoseValue: { fontSize: 18, fontWeight: '700', color: colors.blueDark, marginTop: 4 },
  nextDoseHint: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.blueDark,
    padding: 20,
    paddingBottom: 12,
  },
  modalRow: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalRowText: { fontSize: 16, color: colors.text, fontWeight: '600' },
  modalRowNew: { color: colors.blue },
  modalRowSub: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  modalClose: {
    marginTop: 8,
    marginHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.brownLight,
    borderRadius: 14,
  },
  modalCloseText: { color: colors.brown, fontWeight: '600', fontSize: 16 },
  emptyPicker: { padding: 20, color: colors.textMuted, textAlign: 'center' },
});
