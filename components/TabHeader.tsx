import { View, Text, StyleSheet } from 'react-native';
import { useAppColors } from '../lib/ThemeModeProvider';
import { fonts } from '../lib/typography';

type Props = { title: string; subtitle?: string };

export function TabHeader({ title, subtitle }: Props) {
  const colors = useAppColors();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.sub, { color: colors.textMuted }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontFamily: fonts.titleExtra, fontSize: 26 },
  sub: { fontFamily: fonts.body, fontSize: 14, marginTop: 4 },
});
