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
  Platform,
} from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import { EVENT_LABELS, type EventType } from '../lib/eventTypes';
import { refreshMedicationAlerts } from '../lib/medicationAlerts';
import { Screen } from '../lib/screen';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';

const REGISTRO_TIPOS = ['comida', 'medicacion', 'observacion', 'nota'] as const;
type RegistroTipo = (typeof REGISTRO_TIPOS)[number];

type Prescription = {
  id: string;
  nombre: string;
  dosis_estandar: string;
  intervalo_horas: number;
};

const NEW_MED_ID = '__new__';

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-ES', {
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

function parseTimeOnDate(dateStr: string | undefined, timeStr: string): Date {
  const now = new Date();
  const base = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : now.toISOString().slice(0, 10);
  const [h, m] = timeStr.split(':').map((x) => parseInt(x, 10));
  const [y, mo, d] = base.split('-').map(Number);
  return new Date(y, mo - 1, d, Number.isFinite(h) ? h : now.getHours(), Number.isFinite(m) ? m : now.getMinutes());
}

export default function RegistroScreen() {
  const { session, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const {
    date: paramDate,
    prescriptionId: paramPrescriptionId,
    scheduleId: paramScheduleId,
    dosis: paramDosis,
    intervalo: paramIntervalo,
    hora: paramHora,
    confirm: paramConfirm,
  } = useLocalSearchParams<{
    date?: string;
    prescriptionId?: string;
    scheduleId?: string;
    dosis?: string;
    intervalo?: string;
    hora?: string;
    confirm?: string;
  }>();

  const isConfirmMode = paramConfirm === '1' && !!paramPrescriptionId;

  const [tipo, setTipo] = useState<RegistroTipo>('observacion');
  const [hora, setHora] = useState(() => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  });
  const [contenido, setContenido] = useState('');
  const [saving, setSaving] = useState(false);

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedMedId, setSelectedMedId] = useState<string | null>(null);
  const [dosis, setDosis] = useState('');
  const [newMedNombre, setNewMedNombre] = useState('');
  const [newMedDosisEstandar, setNewMedDosisEstandar] = useState('');
  const [newMedIntervalo, setNewMedIntervalo] = useState('8');
  const [editIntervalo, setEditIntervalo] = useState('8');
  const [prefilled, setPrefilled] = useState(false);
  const [scheduleId, setScheduleId] = useState<string | null>(null);

  const isOrganizador = role === 'organizador';
  const isNewMed = selectedMedId === NEW_MED_ID;
  const selectedPrescription = prescriptions.find((p) => p.id === selectedMedId) ?? null;

  const intervaloHoras = useMemo(() => {
    const raw = isNewMed ? newMedIntervalo : editIntervalo;
    const parsed = parseFloat(raw.replace(',', '.'));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 8;
  }, [isNewMed, newMedIntervalo, editIntervalo]);

  const proximaDosis = useMemo(() => addHours(parseTimeOnDate(paramDate, hora), intervaloHoras), [paramDate, hora, intervaloHoras]);

  const loadPrescriptions = useCallback(async (pid: string) => {
    const { data } = await supabase
      .from('medication_prescriptions')
      .select('id, nombre, dosis_estandar, intervalo_horas')
      .eq('patient_id', pid)
      .eq('activo', true)
      .order('nombre');
    setPrescriptions(data ?? []);
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase.from('patient').select('id').limit(1).maybeSingle().then(({ data }) => {
      if (data?.id) loadPrescriptions(data.id);
    });
  }, [session, loadPrescriptions]);

  useEffect(() => {
    if (selectedPrescription && !isNewMed) {
      setDosis(selectedPrescription.dosis_estandar);
      setEditIntervalo(String(selectedPrescription.intervalo_horas));
    }
  }, [selectedPrescription, isNewMed]);

  useEffect(() => {
    if (prefilled || !paramPrescriptionId || prescriptions.length === 0) return;
    const rx = prescriptions.find((p) => p.id === paramPrescriptionId);
    if (!rx) return;

    setTipo('medicacion');
    setSelectedMedId(paramPrescriptionId);
    setDosis(paramDosis ?? rx.dosis_estandar);
    setEditIntervalo(paramIntervalo ?? String(rx.intervalo_horas));
    if (paramHora) setHora(paramHora);
    if (paramScheduleId) setScheduleId(paramScheduleId);
    setPrefilled(true);
  }, [prefilled, paramPrescriptionId, paramDosis, paramIntervalo, paramHora, paramScheduleId, prescriptions]);

  if (authLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.blue} style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  if (!session) return <Redirect href="/login" />;

  const pickerLabel = () => {
    if (!selectedMedId) return 'Seleccionar medicación';
    if (isNewMed) return 'Nueva medicación';
    return selectedPrescription?.nombre ?? 'Seleccionar medicación';
  };

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
      if (rx) {
        setDosis(rx.dosis_estandar);
        setEditIntervalo(String(rx.intervalo_horas));
      }
    }
  };

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
      if (!newMedNombre.trim() || !newMedDosisEstandar.trim()) {
        Alert.alert('Error', 'Completa nombre y dosis estándar');
        return;
      }

      const { data: rx, error: rxError } = await supabase
        .from('medication_prescriptions')
        .insert({
          patient_id: pid,
          nombre: newMedNombre.trim(),
          dosis_estandar: newMedDosisEstandar.trim(),
          intervalo_horas: intervaloHoras,
          hora_inicio: hora + ':00',
          created_by: session.user.id,
        })
        .select('id, nombre, dosis_estandar')
        .single();

      if (rxError) {
        Alert.alert('Error', rxError.message);
        return;
      }

      prescriptionId = rx.id;
      nombreMedicamento = rx.nombre;
      dosisFinal = dosis.trim() || rx.dosis_estandar;
    } else {
      if (!selectedPrescription) return;
      prescriptionId = selectedPrescription.id;
      nombreMedicamento = selectedPrescription.nombre;
      dosisFinal = dosis.trim() || selectedPrescription.dosis_estandar;

      if (isOrganizador && intervaloHoras !== selectedPrescription.intervalo_horas) {
        await supabase
          .from('medication_prescriptions')
          .update({ intervalo_horas: intervaloHoras })
          .eq('id', prescriptionId);
      }
    }

    if (!dosisFinal.trim()) {
      Alert.alert('Error', 'Indica la dosis administrada');
      return;
    }

    const administradoEn = parseTimeOnDate(paramDate, hora);
    const proxima = addHours(administradoEn, intervaloHoras);

    const { data: log, error: logError } = await supabase
      .from('care_logs')
      .insert({
        patient_id: pid,
        tipo: 'medicacion',
        registrado_por: session.user.id,
        registrado_en: administradoEn.toISOString(),
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

    if (scheduleId) {
      await supabase
        .from('medication_schedules')
        .update({ status: 'administrada', administration_id: log.id })
        .eq('id', scheduleId);
    }
    // El trigger compute_next_dose crea la próxima entrada en medication_schedules.
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: patient } = await supabase.from('patient').select('id').limit(1).maybeSingle();
      if (!patient) {
        Alert.alert('Error', 'No hay paciente configurado');
        return;
      }

      if (tipo === 'medicacion') {
        await saveMedication(patient.id);
      } else {
        if (!contenido.trim()) {
          Alert.alert('Error', 'Escribe una descripción');
          return;
        }

        const registradoEn = parseTimeOnDate(paramDate, hora);

        const { data: log, error: logError } = await supabase
          .from('care_logs')
          .insert({
            patient_id: patient.id,
            tipo,
            registrado_por: session.user.id,
            registrado_en: registradoEn.toISOString(),
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
      }

      await refreshMedicationAlerts();

      const successMessage =
        tipo === 'medicacion'
          ? `Medicación registrada. Próxima dosis: ${formatDateTime(proximaDosis.toISOString())}`
          : 'Evento agregado correctamente';

      router.replace({
        pathname: '/(tabs)/bitacora',
        params: { saved: '1', message: successMessage },
      });
    } catch {
      Alert.alert('Error', 'No se pudo guardar el registro');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Volver</Text>
        </Pressable>
        <Text style={styles.title}>{isConfirmMode ? 'Confirmar medicación' : 'Registro'}</Text>
        {paramDate ? <Text style={styles.sub}>Fecha: {paramDate}</Text> : null}

        {isConfirmMode && selectedPrescription && (
          <View style={styles.confirmBanner}>
            <Text style={styles.confirmBannerText}>
              Revisá los datos y confirmá la administración de {selectedPrescription.nombre}
            </Text>
          </View>
        )}

        {!isConfirmMode && (
          <>
            <Text style={styles.label}>Tipo</Text>
            <View style={styles.chips}>
              {REGISTRO_TIPOS.map((t) => (
                <Pressable key={t} onPress={() => setTipo(t)} style={[styles.chip, tipo === t && styles.chipActive]}>
                  <Text style={[styles.chipText, tipo === t && styles.chipTextActive]}>{EVENT_LABELS[t as EventType]}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Text style={styles.label}>Hora</Text>
        <TextInput
          style={styles.input}
          value={hora}
          onChangeText={setHora}
          placeholder="HH:MM"
          placeholderTextColor={colors.textMuted}
          editable={!isConfirmMode}
        />

        {tipo === 'medicacion' ? (
          <View>
            {!isConfirmMode && (
              <>
                <Text style={styles.label}>Medicación</Text>
                <Pressable style={styles.select} onPress={() => setPickerOpen(true)}>
                  <Text style={[styles.selectText, !selectedMedId && styles.placeholder]}>{pickerLabel()}</Text>
                  <Text style={styles.chevron}>▼</Text>
                </Pressable>
              </>
            )}

            {isConfirmMode && selectedPrescription && (
              <>
                <Text style={styles.label}>Medicación</Text>
                <View style={styles.readonlyField}>
                  <Text style={styles.readonlyText}>{selectedPrescription.nombre}</Text>
                </View>
              </>
            )}

            {isNewMed && (
              <>
                <Text style={styles.label}>Nombre</Text>
                <TextInput style={styles.input} value={newMedNombre} onChangeText={setNewMedNombre} placeholder="Ej. Paracetamol" placeholderTextColor={colors.textMuted} />
                <Text style={styles.label}>Dosis estándar</Text>
                <TextInput style={styles.input} value={newMedDosisEstandar} onChangeText={setNewMedDosisEstandar} placeholder="Ej. 500 mg" placeholderTextColor={colors.textMuted} />
              </>
            )}

            <Text style={styles.label}>Dosis administrada</Text>
            <TextInput
              style={styles.input}
              value={dosis}
              onChangeText={setDosis}
              placeholder="Ej. 500 mg"
              placeholderTextColor={colors.textMuted}
              editable={!isConfirmMode}
            />

            <Text style={styles.label}>Cada cuánto (horas)</Text>
            <TextInput
              style={styles.input}
              value={isNewMed ? newMedIntervalo : editIntervalo}
              onChangeText={isNewMed ? setNewMedIntervalo : setEditIntervalo}
              keyboardType="decimal-pad"
              placeholder="8"
              placeholderTextColor={colors.textMuted}
              editable={!isConfirmMode && (isNewMed || isOrganizador)}
            />
            {!isNewMed && !isOrganizador && (
              <Text style={styles.hint}>Intervalo configurado por la administradora</Text>
            )}

            {selectedMedId && (
              <View style={styles.nextDoseBox}>
                <Text style={styles.nextDoseLabel}>Próxima dosis estimada</Text>
                <Text style={styles.nextDoseValue}>{formatDateTime(proximaDosis.toISOString())}</Text>
                <Text style={styles.nextDoseHint}>Cada {intervaloHoras} h</Text>
              </View>
            )}
          </View>
        ) : (
          <>
            <Text style={styles.label}>Notas</Text>
            <TextInput
              style={styles.textArea}
              value={contenido}
              onChangeText={setContenido}
              multiline
              numberOfLines={4}
              placeholder="Describe el evento…"
              placeholderTextColor={colors.textMuted}
            />
          </>
        )}

        <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.saveBtnText}>{isConfirmMode ? 'Confirmar administración' : 'Agregar'}</Text>
          )}
        </Pressable>
      </ScrollView>

      <Modal visible={pickerOpen} transparent animationType="slide">
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Medicación</Text>
            <FlatList
              data={
                isOrganizador
                  ? [...prescriptions, { id: NEW_MED_ID, nombre: '+ Nueva medicación', dosis_estandar: '', intervalo_horas: 0 }]
                  : prescriptions
              }
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable style={styles.modalRow} onPress={() => selectMedication(item.id)}>
                  <Text style={[styles.modalRowText, item.id === NEW_MED_ID && styles.modalNew]}>{item.nombre}</Text>
                </Pressable>
              )}
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
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: Platform.OS === 'web' ? 32 : 40 },
  back: { marginBottom: 8 },
  backText: { color: colors.blue, fontWeight: '600', fontSize: 16 },
  title: { fontSize: 24, fontWeight: '700', color: colors.blueDark },
  sub: { color: colors.textMuted, marginBottom: 12, marginTop: 4 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8, marginTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.brownLight },
  chipActive: { backgroundColor: colors.blue },
  chipText: { color: colors.brown, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.white,
  },
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
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.white,
  },
  selectText: { fontSize: 16, color: colors.text, flex: 1 },
  placeholder: { color: colors.textMuted },
  chevron: { color: colors.textMuted },
  saveBtn: {
    backgroundColor: colors.blue,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.blueDark, padding: 20 },
  modalRow: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalRowText: { fontSize: 16, color: colors.text, fontWeight: '600' },
  modalNew: { color: colors.blue },
  modalClose: { margin: 20, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.brownLight, borderRadius: 14 },
  modalCloseText: { color: colors.brown, fontWeight: '600' },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  nextDoseBox: {
    marginTop: 12,
    backgroundColor: colors.brownLight,
    borderRadius: 14,
    padding: 14,
  },
  nextDoseLabel: { fontSize: 13, color: colors.brown, fontWeight: '600' },
  nextDoseValue: { fontSize: 18, fontWeight: '700', color: colors.blueDark, marginTop: 4 },
  nextDoseHint: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  confirmBanner: {
    backgroundColor: colors.brownLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  confirmBannerText: { color: colors.blueDark, fontWeight: '600', fontSize: 14 },
  readonlyField: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.brownLight,
  },
  readonlyText: { fontSize: 16, fontWeight: '600', color: colors.text },
});
