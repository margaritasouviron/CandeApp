import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { ConfirmDialog } from './ConfirmDialog';
import {
  deleteUpcomingDoseAndFollowing,
  deleteUpcomingDoseMessage,
  doseStatusLabel,
  formatDoseTime,
  type UpcomingDose,
} from '../lib/medicationSchedules';
import { colors } from '../lib/theme';
import { fonts } from '../lib/typography';

type Props = {
  dose: UpcomingDose;
  muted?: boolean;
  showConfirm?: boolean;
  showDelete?: boolean;
  onConfirm?: () => void;
  onDeleted?: () => void;
};

export function UpcomingDoseCard({
  dose,
  muted = false,
  showConfirm = true,
  showDelete,
  onConfirm,
  onDeleted,
}: Props) {
  const overdue = dose.status === 'retrasada';
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteUpcomingDoseAndFollowing(dose);
      setDeleteOpen(false);
      onDeleted?.();
    } catch {
      setDeleteError('No se pudieron eliminar los suministros. ¿Aplicaste la migración 009 en Supabase?');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <View style={[styles.card, muted && styles.cardMuted, overdue && styles.cardOverdue]}>
        <View style={styles.topRight} pointerEvents="box-none">
          <Text style={[styles.badge, overdue && styles.badgeOverdue]}>{doseStatusLabel(dose.status)}</Text>
          {showDelete && (
            <Pressable
              style={[styles.deleteBtn, Platform.OS === 'web' && styles.webCursor]}
              onPress={() => setDeleteOpen(true)}
              hitSlop={12}
              accessibilityLabel="Eliminar suministros programados"
            >
              <Text style={styles.deleteIcon}>✕</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.contentRow}>
          <View style={[styles.body, showConfirm && styles.bodyWithConfirm]}>
            <Text style={styles.time}>{formatDoseTime(dose.programadoPara)}</Text>
            <Text style={styles.name}>{dose.nombre}</Text>
            <Text style={styles.line}>Dosis: {dose.dosis}</Text>
            {dose.intervaloHoras > 0 && <Text style={styles.line}>Cada {dose.intervaloHoras} h</Text>}
          </View>

          {showConfirm && onConfirm && (
            <Pressable
              style={[styles.confirmBtn, Platform.OS === 'web' && styles.webCursor]}
              onPress={onConfirm}
              accessibilityLabel="Confirmar administración"
            >
              <Text style={styles.confirmIcon}>✓</Text>
            </Pressable>
          )}
        </View>
      </View>

      <ConfirmDialog
        visible={deleteOpen}
        title="Suspender suministros"
        message={deleteUpcomingDoseMessage(dose) + (deleteError ? `\n\n${deleteError}` : '')}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        destructive
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          if (!deleting) {
            setDeleteOpen(false);
            setDeleteError(null);
          }
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    paddingTop: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.greenDark,
  },
  cardMuted: {
    backgroundColor: colors.upcomingMuted,
    borderColor: colors.pink,
    borderLeftColor: 'rgba(56, 189, 248, 0.5)',
    opacity: 0.88,
  },
  cardOverdue: {
    borderLeftColor: colors.error,
    backgroundColor: '#fef2f2',
  },
  topRight: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteBtn: {
    minWidth: 28,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  deleteIcon: {
    fontSize: 15,
    color: colors.textMuted,
    fontWeight: '700',
    lineHeight: 16,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 4,
  },
  body: { flex: 1 },
  bodyWithConfirm: { paddingRight: 10, paddingBottom: 2 },
  time: { fontSize: 14, fontWeight: '700', color: colors.blue, marginBottom: 6, paddingRight: 88 },
  badge: { fontSize: 11, fontWeight: '700', color: colors.blue, textTransform: 'uppercase' },
  badgeOverdue: { color: colors.error },
  name: { fontFamily: fonts.title, fontSize: 16, color: colors.text },
  line: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  confirmBtn: {
    width: 52,
    height: 52,
    borderRadius: 6,
    backgroundColor: 'rgba(22, 163, 74, 0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(22, 163, 74, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginBottom: 2,
  },
  confirmIcon: { color: 'rgba(22, 120, 55, 0.85)', fontSize: 26, fontWeight: '700', marginTop: -1 },
  webCursor: { cursor: 'pointer' } as object,
});
