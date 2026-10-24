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
import {
  EVENT_LABELS,
  REGISTRO_TIPOS,
  TERAPIA_PRESETS,
  isDurationEventType,
  registroChipColors,
  type RegistroTipo,
} from '../lib/eventTypes';
import { refreshMedicationAlerts } from '../lib/medicationAlerts';
import { Screen } from '../lib/screen';
import { supabase } from '../lib/supabase';
import { BackButton } from '../components/BackButton';
import { colors } from '../lib/theme';
import { fonts } from '../lib/typography';

function tipoChipStyle(active: boolean, chipTipo: RegistroTipo) {
  const { accent, inactiveBg } = registroChipColors(chipTipo);
  return {
    chip: {
      backgroundColor: active ? accent : inactiveBg,
      borderColor: accent,
    } as const,
    text: { color: active ? colors.white : accent } as const,
  };
}

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

  const [tipo, setTipo] = useState<RegistroTipo>('comida');
  const [hora, setHora] = useState(() => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  });
  const [comidaFormato, setComidaFormato] = useState<'sopa' | 'jugo'>('sopa');
  const [comidaMl, setComidaMl] = useState('');
  const [rangeStart, setRangeStart] = useState('09:00');
  const [rangeEnd, setRangeEnd] = useState('10:00');
  const [terapiaTipo, setTerapiaTipo] = useState<string>('musicoterapia');
  const [terapiaOtra, setTerapiaOtra] = useState('');
  const [terapiaCustomOpen, setTerapiaCustomOpen] = useState(false);
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

  const saveDurationLog = async (
    pid: string,
    logTipo: RegistroTipo,
    startHm: string,
    endHm: string,
    subtipo?: string | null
  ) => {
    const inicio = parseTimeOnDate(paramDate, startHm);
    let fin = parseTimeOnDate(paramDate, endHm);
    if (fin.getTime() <= inicio.getTime()) {
      fin = new Date(fin.getTime() + 24 * 60 * 60 * 1000);
    }

    const { data: log, error: logError } = await supabase
      .from('care_logs')
      .insert({
        patient_id: pid,
        tipo: logTipo,
        registrado_por: session!.user.id,
        registrado_en: inicio.toISOString(),
      })
      .select('id')
      .single();
    if (logError) throw logError;

    if (logTipo === 'sueno') {
      const { error } = await supabase.from('sleep_entries').insert({
        care_log_id: log.id,
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
      });
      if (error) throw error;
    } else {
      const { error } = await supabase.from('activity_blocks').insert({
        care_log_id: log.id,
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
        subtipo: subtipo ?? null,
      });
      if (error) throw error;
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
      } else if (isDurationEventType(tipo)) {
        let subtipo: string | null = null;
        if (tipo === 'terapia') {
          if (terapiaTipo === 'otra') {
            if (!terapiaOtra.trim()) {
              Alert.alert('Error', 'Indica el tipo de terapia');
              return;
            }
            subtipo = terapiaOtra.trim().toLowerCase();
          } else {
            subtipo = terapiaTipo;
          }
        }
        await saveDurationLog(patient.id, tipo, rangeStart, rangeEnd, subtipo);
      } else if (tipo === 'comida') {
        const ml = parseFloat(comidaMl.replace(',', '.'));
        if (!Number.isFinite(ml) || ml <= 0) {
          Alert.alert('Error', 'Indica los mililitros suministrados');
          return;
        }
        const registradoEn = parseTimeOnDate(paramDate, hora);
        const { data: log, error: logError } = await supabase
          .from('care_logs')
          .insert({
            patient_id: patient.id,
            tipo: 'comida',
            registrado_por: session.user.id,
            registrado_en: registradoEn.toISOString(),
          })
          .select('id')
          .single();
        if (logError) throw logError;
        const { error: mealErr } = await supabase.from('meal_entries').insert({
          care_log_id: log.id,
          tipo_comida: comidaFormato,
          mililitros: ml,
          descripcion: `${comidaFormato} ${ml} ml`,
        });
        if (mealErr) throw mealErr;
      }

      await refreshMedicationAlerts();

      const successMessage =
        tipo === 'medicacion'
          ? `Medicación registrada. Próxima dosis: ${formatDateTime(proximaDosis.toISOString())}`
          : isDurationEventType(tipo)
            ? `${EVENT_LABELS[tipo]} registrado (${rangeStart} – ${rangeEnd})`
            : tipo === 'comida'
              ? `${comidaFormato === 'sopa' ? 'Sopa' : 'Jugo'}: ${comidaMl} ml`
              : 'Evento agregado correctamente';

      router.replace({
        pathname: '/(tabs)/calendar',
        params: { saved: '1', message: successMessage },
      });
    } catch {
      Alert.alert('Error', 'No se pudo guardar el registro');
    } finally {
      setSaving(false);
    }
  };

  const saveAccent = registroChipColors(isConfirmMode ? 'medicacion' : tipo).accent;

  return (
    <Screen>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <BackButton />
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
              {REGISTRO_TIPOS.map((t) => {
                const chip = tipoChipStyle(tipo === t, t);
                return (
                  <Pressable key={t} onPress={() => setTipo(t)} style={[styles.chip, chip.chip]}>
                    <Text style={[styles.chipText, chip.text]}>{EVENT_LABELS[t]}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {(tipo === 'comida' || tipo === 'medicacion') && (
          <>
            <Text style={styles.label}>Hora del suministro</Text>
            <TextInput
              style={styles.input}
              value={hora}
              onChangeText={setHora}
              placeholder="HH:MM"
              placeholderTextColor={colors.textMuted}
              editable={!isConfirmMode}
            />
          </>
        )}

        {tipo === 'comida' && (
          <>
            <Text style={styles.label}>Tipo</Text>
            <View style={styles.chips}>
              {(['sopa', 'jugo'] as const).map((f) => {
                const chip = tipoChipStyle(comidaFormato === f, 'comida');
                return (
                  <Pressable key={f} onPress={() => setComidaFormato(f)} style={[styles.chip, chip.chip]}>
                    <Text style={[styles.chipText, chip.text]}>{f === 'sopa' ? 'Sopa' : 'Jugo'}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.label}>Mililitros suministrados</Text>
            <TextInput
              style={styles.input}
              value={comidaMl}
              onChangeText={setComidaMl}
              keyboardType="decimal-pad"
              placeholder="Ej. 200"
              placeholderTextColor={colors.textMuted}
            />
          </>
        )}

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
        ) : isDurationEventType(tipo) ? (
          <>
            {tipo === 'terapia' && (
              <>
                <Text style={styles.label}>Tipo de terapia</Text>
                <View style={styles.chips}>
                  {TERAPIA_PRESETS.map((t) => {
                    const active = terapiaTipo === t && !terapiaCustomOpen;
                    const chip = tipoChipStyle(active, 'terapia');
                    return (
                      <Pressable
                        key={t}
                        onPress={() => {
                          setTerapiaTipo(t);
                          setTerapiaCustomOpen(false);
                        }}
                        style={[styles.chip, chip.chip]}
                      >
                        <Text style={[styles.chipText, chip.text]}>
                          {t === 'musicoterapia' ? 'Musicoterapia' : 'Kinesiología'}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {(() => {
                    const chip = tipoChipStyle(terapiaCustomOpen, 'terapia');
                    return (
                      <Pressable
                        onPress={() => {
                          setTerapiaTipo('otra');
                          setTerapiaCustomOpen(true);
                        }}
                        style={[styles.chip, chip.chip]}
                      >
                        <Text style={[styles.chipText, chip.text]}>+ Otra</Text>
                      </Pressable>
                    );
                  })()}
                </View>
                {terapiaCustomOpen && (
                  <>
                    <Text style={styles.label}>Nombre de la terapia</Text>
                    <TextInput
                      style={styles.input}
                      value={terapiaOtra}
                      onChangeText={setTerapiaOtra}
                      placeholder="Ej. Fonoaudiología"
                      placeholderTextColor={colors.textMuted}
                    />
                  </>
                )}
              </>
            )}
            <Text style={styles.label}>Desde</Text>
            <TextInput
              style={styles.input}
              value={rangeStart}
              onChangeText={setRangeStart}
              placeholder="HH:MM"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.label}>Hasta</Text>
            <TextInput
              style={styles.input}
              value={rangeEnd}
              onChangeText={setRangeEnd}
              placeholder="HH:MM"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.hint}>Si termina al día siguiente, se calcula automáticamente.</Text>
          </>
        ) : null}

        <Pressable
          style={[styles.saveBtn, { backgroundColor: saveAccent, borderColor: saveAccent }]}
          onPress={handleSave}
          disabled={saving}
        >
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
  title: { fontFamily: fonts.titleExtra, fontSize: 24, color: colors.text },
  sub: { fontFamily: fonts.body, color: colors.textMuted, marginBottom: 12, marginTop: 4 },
  label: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text, marginBottom: 8, marginTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 13 },
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
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 24,
    borderWidth: 1.5,
  },
  saveBtnText: { fontFamily: fonts.title, color: colors.white, fontSize: 16 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  modalTitle: { fontFamily: fonts.title, fontSize: 18, color: colors.text, padding: 20 },
  modalRow: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalRowText: { fontSize: 16, color: colors.text, fontWeight: '600' },
  modalNew: { color: colors.pinkDeep },
  modalClose: {
    margin: 20,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.pinkStrong,
  },
  modalCloseText: { fontFamily: fonts.bodySemi, color: colors.pinkDeep },
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
