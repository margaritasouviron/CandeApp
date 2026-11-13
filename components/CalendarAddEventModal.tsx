import { Modal, View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { CALENDAR_LONG_PRESS_TIPOS, EVENT_LABELS, type RegistroTipo } from '../lib/eventTypes';
import { colors } from '../lib/theme';
import { fonts } from '../lib/typography';

type Props = {
  visible: boolean;
  timeLabel: string;
  onClose: () => void;
  onPick: (tipo: RegistroTipo) => void;
};

export function CalendarAddEventModal({ visible, timeLabel, onClose, onPick }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Agregar evento</Text>
          <Text style={styles.sub}>Horario: {timeLabel}</Text>
          <Text style={styles.hint}>Elegí el tipo de evento</Text>
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {CALENDAR_LONG_PRESS_TIPOS.map((tipo) => (
              <Pressable
                key={tipo}
                style={[styles.row, Platform.OS === 'web' && (styles.webCursor as object)]}
                onPress={() => onPick(tipo)}
              >
                <Text style={styles.rowText}>{EVENT_LABELS[tipo]}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable onPress={onClose} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
    borderWidth: 2,
    borderColor: colors.border,
  },
  title: { fontFamily: fonts.titleExtra, fontSize: 20, color: colors.text },
  sub: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.greenDark, marginTop: 6 },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 4, marginBottom: 12 },
  list: { maxHeight: 360 },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  rowText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  cancel: { marginTop: 14, alignItems: 'center', paddingVertical: 10 },
  cancelText: { fontFamily: fonts.bodySemi, color: colors.pinkDeep, fontSize: 14 },
  webCursor: { cursor: 'pointer' },
});
