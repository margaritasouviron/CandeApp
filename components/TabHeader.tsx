import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../lib/theme';
import { fonts } from '../lib/typography';

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
  title: { fontFamily: fonts.titleExtra, fontSize: 26, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, marginTop: 4 },
});
