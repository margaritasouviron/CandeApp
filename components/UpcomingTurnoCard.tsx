import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { formatTurnoDateTime, type MedicalTurno } from '../lib/medicalAppointments';
import { colors } from '../lib/theme';
import { fonts } from '../lib/typography';

type Props = {
  turno: MedicalTurno;
  muted?: boolean;
  onPress?: () => void;
};

export function UpcomingTurnoCard({ turno, muted = false, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.card, muted && styles.cardMuted, Platform.OS === 'web' && styles.webCursor]}
    >
      <Text style={styles.badge}>Turno médico</Text>
      <Text style={styles.time}>{formatTurnoDateTime(turno.inicio)}</Text>
      <Text style={styles.name}>{turno.nombreMedico}</Text>
      <Text style={styles.line}>{turno.direccion}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#6366F1',
    backgroundColor: colors.card,
  },
  cardMuted: {
    backgroundColor: colors.backgroundAlt,
    borderColor: colors.borderSoft,
  },
  badge: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    color: '#4338CA',
    marginBottom: 4,
  },
  time: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textMuted },
  name: { fontFamily: fonts.title, fontSize: 14, color: colors.text, marginTop: 2 },
  line: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  webCursor: { cursor: 'pointer' },
});
