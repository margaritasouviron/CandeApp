import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { BackButton } from '../../components/BackButton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useAuth } from '../../lib/auth';
import {
  deleteCareLogWithMedicationFollowUp,
  fetchCareLogDetail,
  parseDateTimeLocal,
  updateCareLogDetail,
  type CareLogDetail,
} from '../../lib/careEvents';
import { EVENT_COLORS, EVENT_LABELS } from '../../lib/eventTypes';
import { Screen } from '../../lib/screen';
import { colors } from '../../lib/theme';
import { fonts } from '../../lib/typography';

function formatDisplay(iso: string) {
  return new Date(iso).toLocaleString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function hmFromIso(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function CareLogDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, role, loading: authLoading } = useAuth();
  const router = useRouter();

  const [detail, setDetail] = useState<CareLogDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [text, setText] = useState('');
  const [sleepStart, setSleepStart] = useState('');
  const [sleepEnd, setSleepEnd] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const row = await fetchCareLogDetail(id);
      setDetail(row);
      if (row) {
        const { date: d, time: t } = parseDateTimeLocal(row.registrado_en);
        setDate(d);
        setTime(t);
        setText(row.editableText);
        if (row.sleepInicio) setSleepStart(hmFromIso(row.sleepInicio));
        if (row.sleepFin) setSleepEnd(hmFromIso(row.sleepFin));
      }
    } catch {
      setErrorMsg('No se pudo cargar el registro');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  const canEdit =
    detail &&
    session &&
    (role === 'organizador' || detail.registrado_por === session.user.id);

  const deleteConfirmMessage =
    detail?.tipo === 'medicacion'
      ? 'Se borrará este registro y las medicaciones registradas después (misma medicación), más las dosis programadas posteriores. No se puede deshacer.'
      : 'Se borrará este registro. No se puede deshacer.';

  const handleDeleteConfirm = async () => {
    if (!detail) return;
    setDeleting(true);
    setErrorMsg(null);
    try {
      const count = await deleteCareLogWithMedicationFollowUp(detail.id);
      setDeleteConfirmOpen(false);
      router.replace({
        pathname: '/(tabs)/calendar',
        params: {
          saved: '1',
          message:
            count > 1 ? `Se borraron ${count} registros de medicación` : 'Registro borrado',
        },
      });
    } catch {
      setDeleteConfirmOpen(false);
      setErrorMsg('No se pudo borrar. ¿Aplicaste la migración 016 (borrado) en Supabase?');
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!detail) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await updateCareLogDetail(detail, {
        date,
        time,
        text,
        sleepStart: detail.tipo === 'sueno' ? sleepStart : undefined,
        sleepEnd: detail.tipo === 'sueno' ? sleepEnd : undefined,
      });
      setEditing(false);
      await load();
      router.replace({
        pathname: '/(tabs)/calendar',
        params: { saved: '1', message: 'Registro actualizado' },
      });
    } catch {
      setErrorMsg('No se pudo guardar. ¿Aplicaste la migración 013 en Supabase?');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.pinkDeep} style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  if (!session) return <Redirect href="/login" />;

  if (!id) {
    return (
      <Screen>
        <Text style={styles.error}>Registro no encontrado</Text>
      </Screen>
    );
  }

  const accent = detail ? EVENT_COLORS[detail.tipo] : colors.pink;

  return (
    <Screen>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <BackButton />
          {canEdit && detail && !editing ? (
            <Pressable onPress={() => setDeleteConfirmOpen(true)} hitSlop={8} disabled={deleting}>
              {deleting ? (
                <ActivityIndicator color={colors.error} size="small" />
              ) : (
                <Text style={styles.deleteLink}>Borrar registro</Text>
              )}
            </Pressable>
          ) : (
            <View style={styles.topBarSpacer} />
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.pinkDeep} style={{ marginTop: 24 }} />
        ) : !detail ? (
          <Text style={styles.error}>No existe este registro</Text>
        ) : (
          <>
            <View style={[styles.typePill, { backgroundColor: accent }]}>
              <Text style={styles.typePillText}>{EVENT_LABELS[detail.tipo]}</Text>
            </View>
            <Text style={styles.title}>{detail.title}</Text>

            <Text style={styles.metaLabel}>Registrado por</Text>
            <Text style={styles.metaValue}>{detail.authorName}</Text>

            <Text style={styles.metaLabel}>Fecha y hora</Text>
            {editing ? (
              <View style={styles.row}>
                <TextInput style={[styles.input, styles.inputHalf]} value={date} onChangeText={setDate} placeholder="AAAA-MM-DD" />
                <TextInput style={[styles.input, styles.inputHalf]} value={time} onChangeText={setTime} placeholder="HH:MM" />
              </View>
            ) : (
              <Text style={styles.metaValue}>{formatDisplay(detail.registrado_en)}</Text>
            )}

            {detail.tipo === 'medicacion' && (
              <>
                <Text style={styles.metaLabel}>Medicación</Text>
                <Text style={styles.metaValue}>{detail.medNombre}</Text>
                <Text style={styles.metaLabel}>Dosis</Text>
                {editing ? (
                  <TextInput style={styles.input} value={text} onChangeText={setText} />
                ) : (
                  <Text style={styles.bodyText}>{detail.medDosis ?? detail.detail}</Text>
                )}
              </>
            )}

            {detail.tipo === 'sueno' && (
              <>
                <Text style={styles.metaLabel}>Sueño</Text>
                {editing ? (
                  <>
                    <Text style={styles.hint}>Desde</Text>
                    <TextInput style={styles.input} value={sleepStart} onChangeText={setSleepStart} placeholder="HH:MM" />
                    <Text style={styles.hint}>Hasta</Text>
                    <TextInput style={styles.input} value={sleepEnd} onChangeText={setSleepEnd} placeholder="HH:MM" />
                  </>
                ) : (
                  <Text style={styles.bodyText}>{detail.detail}</Text>
                )}
              </>
            )}

            {(detail.tipo === 'comida' || detail.tipo === 'observacion' || detail.tipo === 'nota') && (
              <>
                <Text style={styles.metaLabel}>Detalle</Text>
                {editing ? (
                  <TextInput style={styles.textArea} value={text} onChangeText={setText} multiline numberOfLines={5} />
                ) : (
                  <Text style={styles.bodyText}>{detail.detail || '—'}</Text>
                )}
              </>
            )}

            {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

            {canEdit && (
              editing ? (
                <View style={styles.actions}>
                  <Pressable style={styles.btnSecondary} onPress={() => setEditing(false)} disabled={saving}>
                    <Text style={styles.btnSecondaryText}>Cancelar</Text>
                  </Pressable>
                  <Pressable style={styles.btnPrimary} onPress={handleSave} disabled={saving}>
                    {saving ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.btnPrimaryText}>Guardar</Text>
                    )}
                  </Pressable>
                </View>
              ) : (
                <Pressable style={styles.btnPrimarySolo} onPress={() => setEditing(true)}>
                  <Text style={styles.btnPrimaryText}>Editar registro</Text>
                </Pressable>
              )
            )}

            {!canEdit && (
              <Text style={styles.hint}>Solo quien lo creó o la administradora puede editarlo.</Text>
            )}
          </>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={deleteConfirmOpen}
        title="¿Estás segura?"
        message={deleteConfirmMessage}
        confirmLabel="Sí, borrar"
        cancelLabel="Cancelar"
        destructive
        loading={deleting}
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => {
          if (!deleting) setDeleteConfirmOpen(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: Platform.OS === 'web' ? 40 : 32 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 12,
  },
  topBarSpacer: { width: 1 },
  deleteLink: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: colors.error,
    paddingTop: 10,
    textDecorationLine: 'underline',
  },
  typePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
  },
  typePillText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.white },
  title: { fontFamily: fonts.titleExtra, fontSize: 22, color: colors.text, marginBottom: 16 },
  metaLabel: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textMuted, marginTop: 12, marginBottom: 4 },
  metaValue: { fontFamily: fonts.body, fontSize: 16, color: colors.text },
  bodyText: { fontFamily: fonts.body, fontSize: 16, color: colors.text, lineHeight: 24 },
  row: { flexDirection: 'row', gap: 8 },
  inputHalf: { flex: 1 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.pinkStrong,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.card,
  },
  textArea: {
    borderWidth: 1.5,
    borderColor: colors.pinkStrong,
    borderRadius: 10,
    padding: 12,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.card,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  btnPrimary: {
    flex: 1,
    backgroundColor: colors.pinkDeep,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnPrimarySolo: {
    marginTop: 24,
    backgroundColor: colors.pinkDeep,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnPrimaryText: { fontFamily: fonts.title, fontSize: 15, color: colors.white },
  btnSecondary: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.pinkStrong,
  },
  btnSecondaryText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.pinkDeep },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 8 },
  error: { fontFamily: fonts.bodySemi, color: colors.error, marginTop: 12 },
});
