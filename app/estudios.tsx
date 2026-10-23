import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Linking,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import {
  deleteMedicalStudy,
  fetchMedicalStudies,
  getMedicalStudySignedUrl,
  pickPdfDocument,
  uploadMedicalStudy,
  type MedicalStudyDocument,
} from '../lib/medicalStudies';
import { getPatient } from '../lib/patientContext';
import { BackButton } from '../components/BackButton';
import { FloatingActionButton } from '../components/FloatingActionButton';
import { Screen } from '../lib/screen';
import { colors } from '../lib/theme';
import { fonts } from '../lib/typography';

function formatStudyDate(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function EstudiosScreen() {
  const { session, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const isOrganizador = role === 'organizador';

  const [list, setList] = useState<MedicalStudyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [keywords, setKeywords] = useState('');
  const [studyDate, setStudyDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filters = useMemo(
    () => ({
      search: debouncedSearch,
      fromDate: fromDate.trim() || undefined,
      toDate: toDate.trim() || undefined,
    }),
    [debouncedSearch, fromDate, toDate]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const patient = await getPatient();
      if (!patient) {
        setList([]);
        return;
      }
      setList(await fetchMedicalStudies(patient.id, filters));
    } catch {
      setErrorMsg('No se pudieron cargar los estudios. ¿Aplicaste la migración 012 en Supabase?');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  const resetForm = () => {
    setTitle('');
    setKeywords('');
    setStudyDate(new Date().toISOString().slice(0, 10));
    setPickedName(null);
    setPickedUri(null);
    setErrorMsg(null);
  };

  const handlePick = async () => {
    setErrorMsg(null);
    try {
      const asset = await pickPdfDocument();
      if (!asset) return;
      setPickedUri(asset.uri);
      setPickedName(asset.name);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'No se pudo elegir el archivo');
    }
  };

  const handleSave = async () => {
    if (!session) return;
    if (!pickedUri || !pickedName) {
      setErrorMsg('Selecciona un PDF');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      const patient = await getPatient();
      if (!patient) {
        setErrorMsg('No hay paciente configurado');
        return;
      }
      await uploadMedicalStudy({
        patientId: patient.id,
        userId: session.user.id,
        title,
        keywords,
        studyDate,
        fileUri: pickedUri,
        fileName: pickedName,
      });
      resetForm();
      setAddOpen(false);
      await load();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'No se pudo subir el estudio');
    } finally {
      setSaving(false);
    }
  };

  const openPdf = async (doc: MedicalStudyDocument) => {
    setOpeningId(doc.id);
    try {
      const url = await getMedicalStudySignedUrl(doc.storage_path);
      await Linking.openURL(url);
    } catch {
      setErrorMsg('No se pudo abrir el PDF');
    } finally {
      setOpeningId(null);
    }
  };

  const handleDelete = async (doc: MedicalStudyDocument) => {
    setErrorMsg(null);
    try {
      await deleteMedicalStudy(doc);
      setList((prev) => prev.filter((d) => d.id !== doc.id));
    } catch {
      setErrorMsg('No se pudo eliminar (solo administradora)');
    }
  };

  if (authLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.greenDark} style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  if (!session) return <Redirect href="/login" />;

  return (
    <Screen>
      <View style={styles.flex}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <BackButton />
        <Text style={styles.screenTitle}>Estudios médicos</Text>
        <Text style={styles.sub}>PDFs de estudios de Cande</Text>

        <Text style={styles.label}>Buscar</Text>
        <TextInput
          style={styles.input}
          value={search}
          onChangeText={setSearch}
          placeholder="Palabras clave en título o etiquetas…"
          placeholderTextColor={colors.textMuted}
        />

        <View style={styles.dateRow}>
          <View style={styles.dateCol}>
            <Text style={styles.labelSmall}>Desde</Text>
            <TextInput
              style={styles.input}
              value={fromDate}
              onChangeText={setFromDate}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.dateCol}>
            <Text style={styles.labelSmall}>Hasta</Text>
            <TextInput
              style={styles.input}
              value={toDate}
              onChangeText={setToDate}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        {(fromDate || toDate) && (
          <Pressable
            onPress={() => {
              setFromDate('');
              setToDate('');
            }}
          >
            <Text style={styles.clearDates}>Quitar filtro de fechas</Text>
          </Pressable>
        )}

        {addOpen && (
          <View style={styles.form}>
            <Text style={styles.label}>Título</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Ej. Resonancia lumbar"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.label}>Fecha del estudio</Text>
            <TextInput
              style={styles.input}
              value={studyDate}
              onChangeText={setStudyDate}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.label}>Palabras clave (opcional)</Text>
            <TextInput
              style={styles.input}
              value={keywords}
              onChangeText={setKeywords}
              placeholder="Ej. columna, neurología"
              placeholderTextColor={colors.textMuted}
            />
            <Pressable style={styles.pickBtn} onPress={handlePick}>
              <Text style={styles.pickBtnText}>{pickedName ? `PDF: ${pickedName}` : 'Elegir PDF'}</Text>
            </Pressable>
            <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.saveBtnText}>Guardar documento</Text>
              )}
            </Pressable>
          </View>
        )}

        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

        <Text style={styles.listTitle}>{loading ? 'Cargando…' : `${list.length} documento(s)`}</Text>

        {loading ? (
          <ActivityIndicator color={colors.greenDark} style={{ marginTop: 16 }} />
        ) : list.length === 0 ? (
          <Text style={styles.empty}>No hay estudios con estos filtros</Text>
        ) : (
          list.map((doc) => (
            <View key={doc.id} style={styles.card}>
              <Text style={styles.cardTitle}>{doc.title}</Text>
              <Text style={styles.cardDate}>{formatStudyDate(doc.study_date)}</Text>
              {doc.keywords ? <Text style={styles.cardKeywords}>{doc.keywords}</Text> : null}
              <Pressable
                style={styles.linkBtn}
                onPress={() => openPdf(doc)}
                disabled={openingId === doc.id}
              >
                {openingId === doc.id ? (
                  <ActivityIndicator color={colors.pinkDeep} size="small" />
                ) : (
                  <Text style={styles.linkBtnText}>Abrir PDF</Text>
                )}
              </Pressable>
              {isOrganizador && (
                <Pressable onPress={() => handleDelete(doc)} hitSlop={8}>
                  <Text style={styles.deleteText}>Eliminar</Text>
                </Pressable>
              )}
            </View>
          ))
        )}
      </ScrollView>
        <FloatingActionButton
          label="Estudio"
          onPress={() => setAddOpen((v) => !v)}
          bottomOffset={16}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: Platform.OS === 'web' ? 120 : 140 },
  screenTitle: { fontFamily: fonts.titleExtra, fontSize: 26, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, marginBottom: 16 },
  label: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text, marginBottom: 6, marginTop: 8 },
  labelSmall: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  input: {
    borderWidth: 2,
    borderColor: colors.pinkStrong,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.card,
  },
  dateRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  dateCol: { flex: 1 },
  clearDates: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: colors.pinkDeep,
    marginTop: 6,
    marginBottom: 4,
  },
  form: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.borderSoft,
    backgroundColor: colors.card,
  },
  pickBtn: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.greenDark,
    alignItems: 'center',
    backgroundColor: colors.brownLight,
  },
  pickBtnText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
  saveBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.pinkDeep,
    alignItems: 'center',
  },
  saveBtnText: { fontFamily: fonts.title, fontSize: 15, color: colors.white },
  error: { fontFamily: fonts.bodySemi, color: colors.error, marginTop: 12 },
  listTitle: { fontFamily: fonts.title, fontSize: 16, color: colors.text, marginTop: 20, marginBottom: 10 },
  empty: { fontFamily: fonts.body, color: colors.textMuted },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: colors.pinkStrong,
  },
  cardTitle: { fontFamily: fonts.title, fontSize: 16, color: colors.text },
  cardDate: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 4 },
  cardKeywords: { fontFamily: fonts.body, fontSize: 12, color: colors.greenDark, marginTop: 6 },
  linkBtn: { marginTop: 10, alignSelf: 'flex-start' },
  linkBtnText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.pinkDeep, textDecorationLine: 'underline' },
  deleteText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.error, marginTop: 8 },
});
