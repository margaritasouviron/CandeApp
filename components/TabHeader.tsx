import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../lib/theme';

type Props = { title: string; subtitle?: string };

export function TabHeader({ title, subtitle }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '700', color: colors.blueDark },
  sub: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
});
