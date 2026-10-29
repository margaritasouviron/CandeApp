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
  SLEEP_EVENT_TYPE,
  type RegistroTipo,
} from '../lib/eventTypes';
import {
  fetchInventory,
  findPrescriptionInList,
  inventoryMedPickerId,
  normalizeInventoryName,
  parseInventoryMedPickerId,
  type InventoryItem,
} from '../lib/inventory';
import { hasPatientReceivedMedication } from '../lib/medicationHistory';
import { refreshMedicationAlerts } from '../lib/medicationAlerts';
import {
  endMealSession,
  fetchActiveMealSession,
  formatMealClock,
  startMealSession,
  type ActiveMealSession,
} from '../lib/mealSession';
import {
  endSleepSession,
  fetchActiveSleepSession,
  formatSleepClock,
  startSleepSession,
  type ActiveSleepSession,
} from '../lib/sleepSession';
import {
  fetchStockConsumptionDefaults,
  isStockConsumptionEventType,
  saveCareLogWithStockConsumption,
  type StockConsumptionEventType,
} from '../lib/stockConsumptionEvents';
import { Screen } from '../lib/screen';
import { supabase } from '../lib/supabase';
import { BackButton } from '../components/BackButton';
import { useThemeMode } from '../lib/ThemeModeProvider';
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

type MedPickerRow = {
  id: string;
  nombre: string;
  subtitle?: string;
  kind: 'inv' | 'rx' | 'new';
};

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
  const { refreshTheme } = useThemeMode();
  const router = useRouter();
  const {
    date: paramDate,
    prescriptionId: paramPrescriptionId,
    scheduleId: paramScheduleId,
    dosis: paramDosis,
    intervalo: paramIntervalo,
    hora: paramHora,
    confirm: paramConfirm,
    tipo: paramTipo,
    sleepShortcut: paramSleepShortcut,
  } = useLocalSearchParams<{
    date?: string;
    prescriptionId?: string;
    scheduleId?: string;
    dosis?: string;
    intervalo?: string;
    hora?: string;
    confirm?: string;
    tipo?: string;
    sleepShortcut?: string;
  }>();

  const isConfirmMode = paramConfirm === '1' && !!paramPrescriptionId;

  const [tipo, setTipo] = useState<RegistroTipo>('comida');
  const [hora, setHora] = useState(() => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  });
  const [comidaFormato, setComidaFormato] = useState<'sopa' | 'jugo'>('sopa');
  const [comidaMl, setComidaMl] = useState('');
  const [comidaVelocidad, setComidaVelocidad] = useState('');
  const [rangeStart, setRangeStart] = useState('09:00');
  const [rangeEnd, setRangeEnd] = useState('10:00');
  const [terapiaTipo, setTerapiaTipo] = useState<string>('musicoterapia');
  const [terapiaOtra, setTerapiaOtra] = useState('');
  const [terapiaCustomOpen, setTerapiaCustomOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [stockConsumeQty, setStockConsumeQty] = useState('1');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedMedId, setSelectedMedId] = useState<string | null>(null);
  const [dosis, setDosis] = useState('');
  const [dosisHabitual, setDosisHabitual] = useState('');
  const [medFirstTime, setMedFirstTime] = useState<boolean | null>(null);
  const [newMedNombre, setNewMedNombre] = useState('');
  const [newMedIntervalo, setNewMedIntervalo] = useState('8');
  const [editIntervalo, setEditIntervalo] = useState('8');
  const [prefilled, setPrefilled] = useState(false);
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [stockLines, setStockLines] = useState<
    { itemId: string; nombre: string; unidad: string; qty: string }[]
  >([]);
  const [stockLinesLoading, setStockLinesLoading] = useState(false);
  const [activeSleep, setActiveSleep] = useState<ActiveSleepSession | null>(null);
  const [activeMeal, setActiveMeal] = useState<ActiveMealSession | null>(null);

  const isOrganizador = role === 'organizador';
  const isNewMed = selectedMedId === NEW_MED_ID;
  const selectedInventoryId = parseInventoryMedPickerId(selectedMedId);
  const isInventoryMed = !!selectedInventoryId;
  const selectedInventoryItem =
    inventoryItems.find((i) => i.id === selectedInventoryId) ?? null;
  const selectedPrescription =
    !isInventoryMed && !isNewMed && selectedMedId
      ? (prescriptions.find((p) => p.id === selectedMedId) ?? null)
      : null;

  const medPickerRows = useMemo((): MedPickerRow[] => {
    const rows: MedPickerRow[] = inventoryItems.map((item) => ({
      id: inventoryMedPickerId(item.id),
      nombre: item.nombre,
      subtitle: `Stock: ${Number(item.cantidad_actual)} ${item.unidad}`,
      kind: 'inv',
    }));
    const stockNames = new Set(inventoryItems.map((i) => normalizeInventoryName(i.nombre)));
    for (const rx of prescriptions) {
      if (stockNames.has(normalizeInventoryName(rx.nombre))) continue;
      rows.push({
        id: rx.id,
        nombre: rx.nombre,
        subtitle: rx.dosis_estandar,
        kind: 'rx',
      });
    }
    rows.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    if (isOrganizador) {
      rows.push({ id: NEW_MED_ID, nombre: '+ Nueva medicación', kind: 'new' });
    }
    return rows;
  }, [inventoryItems, prescriptions, isOrganizador]);

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

  const loadActiveSleep = useCallback(async (patientId: string) => {
    try {
      setActiveSleep(await fetchActiveSleepSession(patientId));
    } catch {
      setActiveSleep(null);
    }
  }, []);

  const loadActiveMeal = useCallback(async (patientId: string) => {
    try {
      setActiveMeal(await fetchActiveMealSession(patientId));
    } catch {
      setActiveMeal(null);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase.from('patient').select('id').limit(1).maybeSingle().then(({ data }) => {
      if (!data?.id) return;
      void loadPrescriptions(data.id);
      void fetchInventory(data.id).then(setInventoryItems).catch(() => setInventoryItems([]));
      void loadActiveSleep(data.id);
      void loadActiveMeal(data.id);
    });
  }, [session, loadPrescriptions, loadActiveSleep, loadActiveMeal]);

  useEffect(() => {
    if (paramTipo === SLEEP_EVENT_TYPE || paramSleepShortcut === '1') {
      setTipo(SLEEP_EVENT_TYPE);
    }
  }, [paramTipo, paramSleepShortcut]);

  const applyMedicationDoseContext = useCallback(
    async (nombre: string, invItem?: InventoryItem | null) => {
      const trimmed = nombre.trim();
      if (!trimmed) {
        setMedFirstTime(null);
        setDosisHabitual('');
        setDosis('');
        return;
      }
      const rx = findPrescriptionInList(prescriptions, trimmed);
      const { data: patient } = await supabase.from('patient').select('id').limit(1).maybeSingle();
      let firstTime = true;
      if (patient?.id) {
        firstTime = !(await hasPatientReceivedMedication(patient.id, trimmed));
      }
      setMedFirstTime(firstTime);
      const habitual = rx?.dosis_estandar ?? '';
      setDosisHabitual(habitual);
      setDosis(habitual || (invItem ? `1 ${invItem.unidad}` : ''));
      if (rx) setEditIntervalo(String(rx.intervalo_horas));
    },
    [prescriptions]
  );

  useEffect(() => {
    if (prefilled || !paramPrescriptionId || prescriptions.length === 0) return;
    const rx = prescriptions.find((p) => p.id === paramPrescriptionId);
    if (!rx) return;

    setTipo('medicacion');
    setSelectedMedId(paramPrescriptionId);
    setDosisHabitual(rx.dosis_estandar);
    setDosis(paramDosis ?? rx.dosis_estandar);
    setMedFirstTime(false);
    setEditIntervalo(paramIntervalo ?? String(rx.intervalo_horas));
    if (paramHora) setHora(paramHora);
    if (paramScheduleId) setScheduleId(paramScheduleId);
    setPrefilled(true);
  }, [prefilled, paramPrescriptionId, paramDosis, paramIntervalo, paramHora, paramScheduleId, prescriptions]);

  useEffect(() => {
    if (!session || !isStockConsumptionEventType(tipo)) {
      setStockLines([]);
      return;
    }
    let cancelled = false;
    setStockLinesLoading(true);
    void (async () => {
      try {
        const { data: patient } = await supabase.from('patient').select('id').limit(1).maybeSingle();
        if (!patient?.id || cancelled) return;
        const defaults = await fetchStockConsumptionDefaults(patient.id, tipo as StockConsumptionEventType);
        if (cancelled) return;
        setStockLines(
          defaults.map((d) => ({
            itemId: d.itemId,
            nombre: d.nombre,
            unidad: d.unidad,
            qty: String(d.defaultQty),
          }))
        );
      } catch {
        if (!cancelled) setStockLines([]);
      } finally {
        if (!cancelled) setStockLinesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, tipo]);

  const setStockLineQty = (itemId: string, qty: string) => {
    setStockLines((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, qty } : l)));
  };

  if (authLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.blue} style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  if (!session) return <Redirect href="/login" />;

  const pickerLabel = () => {
    if (!selectedMedId) return 'Seleccionar del stock o medicación';
    if (isNewMed) return 'Nueva medicación';
    if (selectedInventoryItem) return selectedInventoryItem.nombre;
    return selectedPrescription?.nombre ?? 'Seleccionar del stock o medicación';
  };

  const selectMedication = (id: string) => {
    setSelectedMedId(id);
    setPickerOpen(false);
    if (id === NEW_MED_ID) {
      setDosis('');
      setDosisHabitual('');
      setNewMedNombre('');
      setNewMedIntervalo('8');
      setStockConsumeQty('1');
      setMedFirstTime(true);
    } else {
      const invId = parseInventoryMedPickerId(id);
      if (invId) {
        const item = inventoryItems.find((i) => i.id === invId);
        setStockConsumeQty('1');
        void applyMedicationDoseContext(item?.nombre ?? '', item);
      } else {
        const rx = prescriptions.find((p) => p.id === id);
        setStockConsumeQty('1');
        if (rx) void applyMedicationDoseContext(rx.nombre);
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

    const { error } = await supabase.from('activity_blocks').insert({
      care_log_id: log.id,
      inicio: inicio.toISOString(),
      fin: fin.toISOString(),
      subtipo: subtipo ?? null,
    });
    if (error) throw error;
  };

  const upsertPrescriptionHabitual = async (
    pid: string,
    nombre: string,
    habitual: string
  ): Promise<string | null> => {
    const trimmedNombre = nombre.trim();
    const trimmedHabitual = habitual.trim();
    const existing = findPrescriptionInList(prescriptions, trimmedNombre);
    if (existing) {
      if (existing.dosis_estandar !== trimmedHabitual) {
        const { error } = await supabase
          .from('medication_prescriptions')
          .update({ dosis_estandar: trimmedHabitual })
          .eq('id', existing.id);
        if (error) throw error;
      }
      if (isOrganizador && intervaloHoras !== existing.intervalo_horas) {
        await supabase
          .from('medication_prescriptions')
          .update({ intervalo_horas: intervaloHoras })
          .eq('id', existing.id);
      }
      return existing.id;
    }

    const { data: rx, error: rxError } = await supabase
      .from('medication_prescriptions')
      .insert({
        patient_id: pid,
        nombre: trimmedNombre,
        dosis_estandar: trimmedHabitual,
        intervalo_horas: intervaloHoras,
        hora_inicio: hora + ':00',
        created_by: session.user.id,
      })
      .select('id')
      .single();
    if (rxError) throw rxError;
    await loadPrescriptions(pid);
    return rx.id as string;
  };

  const saveMedication = async (pid: string) => {
    if (!selectedMedId) {
      Alert.alert('Error', 'Selecciona una medicación');
      return;
    }

    let prescriptionId: string | null = null;
    let nombreMedicamento: string;
    const habitualTrim = dosisHabitual.trim();
    const dosisFinal = dosis.trim() || habitualTrim;

    if (isNewMed) {
      if (!isOrganizador) {
        Alert.alert('Error', 'Solo la administradora puede agregar nuevas medicaciones');
        return;
      }
      if (!newMedNombre.trim()) {
        Alert.alert('Error', 'Indica el nombre de la medicación');
        return;
      }
      if (!habitualTrim) {
        Alert.alert('Error', 'Indica la dosis habitual');
        return;
      }
      nombreMedicamento = newMedNombre.trim();
      prescriptionId = await upsertPrescriptionHabitual(pid, nombreMedicamento, habitualTrim);
    } else if (isInventoryMed && selectedInventoryItem) {
      nombreMedicamento = selectedInventoryItem.nombre;
      if (!habitualTrim && medFirstTime) {
        Alert.alert('Error', 'Es la primera vez con esta medicación: indica la dosis habitual');
        return;
      }
      if (habitualTrim) {
        prescriptionId = await upsertPrescriptionHabitual(pid, nombreMedicamento, habitualTrim);
      } else {
        const rx = findPrescriptionInList(prescriptions, nombreMedicamento);
        prescriptionId = rx?.id ?? null;
      }
    } else {
      if (!selectedPrescription) return;
      nombreMedicamento = selectedPrescription.nombre;
      prescriptionId = selectedPrescription.id;
      if (habitualTrim && habitualTrim !== selectedPrescription.dosis_estandar) {
        const { error } = await supabase
          .from('medication_prescriptions')
          .update({ dosis_estandar: habitualTrim })
          .eq('id', prescriptionId);
        if (error) throw error;
      }
      if (isOrganizador && intervaloHoras !== selectedPrescription.intervalo_horas) {
        await supabase
          .from('medication_prescriptions')
          .update({ intervalo_horas: intervaloHoras })
          .eq('id', prescriptionId);
      }
    }

    if (!habitualTrim && medFirstTime) {
      Alert.alert('Error', 'Indica la dosis habitual');
      return;
    }

    if (!dosisFinal.trim()) {
      Alert.alert('Error', 'Indica la dosis administrada');
      return;
    }

    if (isInventoryMed) {
      const qty = parseFloat(stockConsumeQty.replace(',', '.'));
      if (!Number.isFinite(qty) || qty <= 0) {
        Alert.alert('Error', 'Indica cuánto descontar del stock (mayor a 0)');
        return;
      }
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

    const cantidadInventario = isInventoryMed
      ? parseFloat(stockConsumeQty.replace(',', '.'))
      : null;

    const { error: adminError } = await supabase.from('medication_administrations').insert({
      care_log_id: log.id,
      prescription_id: prescriptionId,
      nombre_medicamento: nombreMedicamento,
      dosis: dosisFinal.trim(),
      administrado_en: administradoEn.toISOString(),
      proxima_dosis_en: proxima.toISOString(),
      inventory_item_id: isInventoryMed ? selectedInventoryItem!.id : null,
      cantidad_inventario:
        isInventoryMed && Number.isFinite(cantidadInventario!) && cantidadInventario! > 0
          ? cantidadInventario
          : isInventoryMed
            ? 1
            : null,
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

      if (tipo === SLEEP_EVENT_TYPE) {
        const when = parseTimeOnDate(paramDate, hora);
        if (activeSleep) {
          await endSleepSession(activeSleep.careLogId, when, activeSleep.inicio);
        } else {
          await startSleepSession(patient.id, session!.user.id, when);
        }
        await loadActiveSleep(patient.id);
        await refreshTheme();
      } else if (tipo === 'medicacion') {
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
        const when = parseTimeOnDate(paramDate, hora);
        if (activeMeal) {
          await endMealSession(activeMeal.careLogId, when, activeMeal.inicio);
        } else {
          const ml = parseFloat(comidaMl.replace(',', '.'));
          if (!Number.isFinite(ml) || ml <= 0) {
            Alert.alert('Error', 'Indica los mililitros');
            return;
          }
          const velRaw = comidaVelocidad.trim();
          const velocidadMlH = velRaw ? parseFloat(velRaw.replace(',', '.')) : null;
          if (velRaw && (!Number.isFinite(velocidadMlH!) || velocidadMlH! <= 0)) {
            Alert.alert('Error', 'Indica una velocidad válida (ml/h) o dejá el campo vacío');
            return;
          }
          await startMealSession(patient.id, session!.user.id, when, {
            tipoComida: comidaFormato,
            mililitros: ml,
            velocidadMlH: velocidadMlH ?? null,
          });
        }
        await loadActiveMeal(patient.id);
      } else if (isStockConsumptionEventType(tipo)) {
        const lines = stockLines
          .map((l) => {
            const cantidad = parseFloat(l.qty.replace(',', '.'));
            return {
              itemId: l.itemId,
              nombre: l.nombre,
              unidad: l.unidad,
              cantidad,
            };
          })
          .filter((l) => Number.isFinite(l.cantidad) && l.cantidad > 0);
        await saveCareLogWithStockConsumption({
          patientId: patient.id,
          tipo,
          registradoPor: session!.user.id,
          registradoEn: parseTimeOnDate(paramDate, hora),
          lines,
        });
      }

      await refreshMedicationAlerts();

      const successMessage =
        tipo === SLEEP_EVENT_TYPE
          ? activeSleep
            ? `Despertar registrado (${hora})`
            : `Sueño registrado: se durmió a las ${hora}`
          : tipo === 'medicacion'
            ? `Medicación registrada. Próxima dosis: ${formatDateTime(proximaDosis.toISOString())}`
            : isDurationEventType(tipo)
              ? `${EVENT_LABELS[tipo]} registrado (${rangeStart} – ${rangeEnd})`
              : tipo === 'comida'
                ? activeMeal
                  ? `Botón desconectado (${hora})`
                  : `Botón conectado: ${comidaFormato === 'sopa' ? 'sopa' : 'jugo'}, ${comidaMl} ml`
                : isStockConsumptionEventType(tipo)
                  ? `${EVENT_LABELS[tipo]} registrada. Stock actualizado.`
                  : 'Evento agregado correctamente';

      router.replace({
        pathname: '/(tabs)/calendar',
        params: { saved: '1', message: successMessage },
      });
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : '';
      if (msg.includes('Cande ya figura')) {
        Alert.alert('Sueño', msg);
      } else if (msg.includes('botón ya está conectado')) {
        Alert.alert('Comida', msg);
      } else if (/row-level security|rx_insert|42501/i.test(msg)) {
        Alert.alert(
          'Error',
          'No se pudo guardar la dosis habitual. Ejecutá supabase/migrations/023_medication_habitual_dose_rls.sql en Supabase.'
        );
      } else if (/proteina|limpieza_boton|cambio_panal|gotitas|inventory_consumption|enum|42703/i.test(msg)) {
        Alert.alert(
          'Error',
          'Falta aplicar supabase/migrations/020_proteina_event.sql y 021_stock_consumption_events.sql en Supabase.'
        );
      } else if (msg.includes('Indica al menos un insumo')) {
        Alert.alert('Error', msg);
      } else {
        Alert.alert('Error', 'No se pudo guardar el registro');
      }
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

        {(tipo === 'medicacion' || isStockConsumptionEventType(tipo)) && (
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

        {isStockConsumptionEventType(tipo) && (
          <>
            <Text style={styles.label}>Insumos a descontar del stock</Text>
            <Text style={styles.hint}>Valores sugeridos desde la planilla; podés ajustar cada cantidad.</Text>
            {stockLinesLoading ? (
              <ActivityIndicator color={colors.pinkDeep} style={{ marginVertical: 12 }} />
            ) : stockLines.length === 0 ? (
              <Text style={styles.hint}>
                No hay insumos configurados para este evento. Ejecutá la migración 021 en Supabase.
              </Text>
            ) : (
              <View style={styles.stockList}>
                {stockLines.map((line) => (
                  <View key={line.itemId} style={styles.stockRow}>
                    <Text style={styles.stockName} numberOfLines={2}>
                      {line.nombre}
                    </Text>
                    <TextInput
                      style={styles.stockQtyInput}
                      value={line.qty}
                      onChangeText={(v) => setStockLineQty(line.itemId, v)}
                      keyboardType="decimal-pad"
                      placeholderTextColor={colors.textMuted}
                    />
                    <Text style={styles.stockUnit}>{line.unidad}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {tipo === 'comida' && (
          <>
            {activeMeal ? (
              <View style={styles.sleepStatusAwake}>
                <Text style={styles.sleepStatusTitle}>Botón conectado</Text>
                <Text style={styles.sleepStatusSub}>
                  Cande está comiendo · desde las {formatMealClock(activeMeal.inicio)}
                </Text>
                <Text style={styles.sleepStatusSub}>
                  {activeMeal.tipoComida === 'sopa' ? 'Sopa' : 'Jugo'} · {activeMeal.mililitros} ml
                  {activeMeal.velocidadMlH != null && activeMeal.velocidadMlH > 0
                    ? ` · ${activeMeal.velocidadMlH} ml/h`
                    : ''}
                </Text>
              </View>
            ) : (
              <View style={styles.sleepStatusAwake}>
                <Text style={styles.sleepStatusTitle}>Botón desconectado</Text>
                <Text style={styles.sleepStatusSub}>
                  Registrá la conexión del botón, el tipo, la velocidad y los ml.
                </Text>
              </View>
            )}
            {!activeMeal && (
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
                <Text style={styles.label}>Velocidad (ml/h)</Text>
                <TextInput
                  style={styles.input}
                  value={comidaVelocidad}
                  onChangeText={setComidaVelocidad}
                  keyboardType="decimal-pad"
                  placeholder="Ej. 80"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.label}>Mililitros</Text>
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
            <Text style={styles.label}>
              {activeMeal ? 'Se desconectó el botón a las' : 'Se conectó el botón a las'}
            </Text>
            <TextInput
              style={styles.input}
              value={hora}
              onChangeText={setHora}
              placeholder="HH:MM"
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
              </>
            )}

            {medFirstTime && selectedMedId && !isConfirmMode ? (
              <View style={styles.firstMedBanner}>
                <Text style={styles.firstMedBannerText}>
                  Primera vez con esta medicación: indicá la dosis habitual para Cande.
                </Text>
              </View>
            ) : null}

            {selectedMedId && !isConfirmMode && !isNewMed ? (
              <>
                <Text style={styles.label}>Dosis habitual</Text>
                <TextInput
                  style={styles.input}
                  value={dosisHabitual}
                  onChangeText={setDosisHabitual}
                  placeholder="Ej. 500 mg"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.hint}>Valor por defecto en futuros registros. Podés cambiarlo acá cuando haga falta.</Text>
              </>
            ) : null}

            {isNewMed && (
              <>
                <Text style={styles.label}>Dosis habitual</Text>
                <TextInput
                  style={styles.input}
                  value={dosisHabitual}
                  onChangeText={setDosisHabitual}
                  placeholder="Ej. 500 mg"
                  placeholderTextColor={colors.textMuted}
                />
              </>
            )}

            {isInventoryMed && selectedInventoryItem && (
              <>
                <Text style={styles.label}>Descontar del stock</Text>
                <View style={styles.stockRow}>
                  <Text style={styles.stockName} numberOfLines={2}>
                    {selectedInventoryItem.nombre}
                  </Text>
                  <TextInput
                    style={styles.stockQtyInput}
                    value={stockConsumeQty}
                    onChangeText={setStockConsumeQty}
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.textMuted}
                  />
                  <Text style={styles.stockUnit}>{selectedInventoryItem.unidad}</Text>
                </View>
                <Text style={styles.hint}>
                  Disponible: {Number(selectedInventoryItem.cantidad_actual)} {selectedInventoryItem.unidad}
                </Text>
              </>
            )}

            <Text style={styles.label}>Dosis administrada ahora</Text>
            <TextInput
              style={styles.input}
              value={dosis}
              onChangeText={setDosis}
              placeholder={dosisHabitual.trim() || 'Ej. 500 mg'}
              placeholderTextColor={colors.textMuted}
              editable={!isConfirmMode}
            />
            {!isConfirmMode && dosisHabitual.trim() ? (
              <Pressable
                style={styles.useHabitualLink}
                onPress={() => setDosis(dosisHabitual.trim())}
              >
                <Text style={styles.useHabitualLinkText}>Usar dosis habitual ({dosisHabitual.trim()})</Text>
              </Pressable>
            ) : null}

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
        ) : tipo === SLEEP_EVENT_TYPE ? (
          <>
            {activeSleep ? (
              <View style={styles.sleepStatusAwake}>
                <Text style={styles.sleepStatusTitle}>Cande está dormida</Text>
                <Text style={styles.sleepStatusSub}>
                  Desde las {formatSleepClock(activeSleep.inicio)}
                </Text>
              </View>
            ) : (
              <View style={styles.sleepStatusAwake}>
                <Text style={styles.sleepStatusTitle}>Cande despierta</Text>
                <Text style={styles.sleepStatusSub}>Registrá a qué hora se durmió.</Text>
              </View>
            )}
            <Text style={styles.label}>{activeSleep ? 'Se despertó a las' : 'Se durmió a las'}</Text>
            <TextInput
              style={styles.input}
              value={hora}
              onChangeText={setHora}
              placeholder="HH:MM"
              placeholderTextColor={colors.textMuted}
            />
          </>
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
            <Text style={styles.saveBtnText}>
              {tipo === SLEEP_EVENT_TYPE
                ? activeSleep
                  ? 'Registrar despertar'
                  : 'Registrar que se durmió'
                : tipo === 'comida'
                  ? activeMeal
                    ? 'Registrar desconexión del botón'
                    : 'Registrar conexión del botón'
                  : isConfirmMode
                  ? 'Confirmar administración'
                  : 'Agregar'}
            </Text>
          )}
        </Pressable>
      </ScrollView>

      <Modal visible={pickerOpen} transparent animationType="slide">
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Medicación (stock)</Text>
            <FlatList
              data={medPickerRows}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <Text style={styles.modalEmpty}>No hay ítems en stock. Agregá insumos en la pestaña Stock.</Text>
              }
              renderItem={({ item }) => (
                <Pressable style={styles.modalRow} onPress={() => selectMedication(item.id)}>
                  <Text style={[styles.modalRowText, item.kind === 'new' && styles.modalNew]}>{item.nombre}</Text>
                  {item.subtitle ? <Text style={styles.modalRowSub}>{item.subtitle}</Text> : null}
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
  modalRowSub: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  modalEmpty: { fontFamily: fonts.body, color: colors.textMuted, paddingHorizontal: 20, paddingVertical: 16 },
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
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 4, marginBottom: 4, lineHeight: 17 },
  stockList: { marginTop: 8, gap: 8 },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    backgroundColor: colors.card,
  },
  stockName: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  stockQtyInput: {
    width: 72,
    borderWidth: 1.5,
    borderColor: colors.pinkStrong,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    textAlign: 'right',
    backgroundColor: colors.white,
  },
  stockUnit: { width: 56, fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
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
  firstMedBanner: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.brownLight,
    borderWidth: 1,
    borderColor: colors.pinkStrong,
  },
  firstMedBannerText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text, lineHeight: 18 },
  useHabitualLink: { marginTop: 6, marginBottom: 4, alignSelf: 'flex-start' },
  useHabitualLinkText: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: colors.pinkDeep,
    textDecorationLine: 'underline',
  },
  sleepStatusAwake: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(132, 204, 22, 0.15)',
    borderWidth: 1.5,
    borderColor: colors.green,
  },
  sleepStatusTitle: { fontFamily: fonts.title, fontSize: 16, color: colors.greenDark },
  sleepStatusSub: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 4 },
  readonlyField: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.brownLight,
  },
  readonlyText: { fontSize: 16, fontWeight: '600', color: colors.text },
});
