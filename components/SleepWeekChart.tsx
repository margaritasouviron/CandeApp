import { View, StyleSheet } from 'react-native';
import { colors } from '../lib/theme';
import { fonts } from '../lib/typography';
import { Text } from 'react-native';
import type { SleepDayHours } from '../lib/sleepStats';

type Props = {
  days: SleepDayHours[];
  averageHours: number;
};

export function SleepWeekChart({ days, averageHours }: Props) {
  const max = Math.max(...days.map((d) => d.hours), 1);

  return (
    <View style={styles.wrap}>
      <Text style={styles.avg}>Promedio: {averageHours} h / noche</Text>
      <View style={styles.bars}>
        {days.map((d) => {
          const pct = (d.hours / max) * 100;
          const label = d.date.slice(8);
          return (
            <View key={d.date} style={styles.col}>
              <View style={styles.track}>
                <View style={[styles.fill, { height: `${pct}%` }]} />
              </View>
              <Text style={styles.day}>{label}</Text>
              <Text style={styles.hrs}>{d.hours}h</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 20,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.pink,
    marginBottom: 16,
  },
  avg: { fontFamily: fonts.title, fontSize: 16, color: colors.text, marginBottom: 12 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 120 },
  col: { flex: 1, alignItems: 'center' },
  track: {
    width: '70%',
    height: 90,
    backgroundColor: colors.pink,
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  fill: { width: '100%', backgroundColor: colors.green, borderRadius: 8 },
  day: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 4 },
  hrs: { fontFamily: fonts.bodySemi, fontSize: 10, color: colors.text },
});
