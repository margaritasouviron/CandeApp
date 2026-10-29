import { View, Text, StyleSheet } from 'react-native';
import { useMemo } from 'react';
import { EVENT_COLORS, EVENT_LABELS, type EventType } from '../lib/eventTypes';
import { useAppColors } from '../lib/ThemeModeProvider';
import { fonts } from '../lib/typography';
import type { AppColors } from '../lib/theme';

type Props = {
  tipo: string;
  time: string;
  title: string;
  subtitle?: string;
  /** Sin caja — solo texto y punto de color */
  plain?: boolean;
};

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardPlain: {
      backgroundColor: 'transparent',
      borderWidth: 0,
      paddingHorizontal: 0,
      paddingVertical: 6,
      marginBottom: 2,
    },
    dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, marginRight: 12 },
    body: { flex: 1 },
    time: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.greenDark },
    title: { fontFamily: fonts.title, fontSize: 15, color: colors.text, marginTop: 2 },
    sub: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 4 },
    badge: { fontFamily: fonts.body, fontSize: 12, marginTop: 6 },
  });
}

export function EventCard({ tipo, time, title, subtitle, plain }: Props) {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const color = EVENT_COLORS[tipo as EventType] ?? colors.textMuted;
  return (
    <View style={[styles.card, plain && styles.cardPlain]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={styles.body}>
        <Text style={styles.time}>{time}</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
        <Text style={[styles.badge, { color }]}>{EVENT_LABELS[tipo as EventType] ?? tipo}</Text>
      </View>
    </View>
  );
}
