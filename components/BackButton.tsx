import { Pressable, Text, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../lib/theme';
import { fonts } from '../lib/typography';

type Props = { label?: string };

export function BackButton({ label = 'Volver' }: Props) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.back()}
      style={[styles.wrap, Platform.OS === 'web' && styles.webCursor]}
      hitSlop={8}
    >
      <Text style={styles.arrow}>‹</Text>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.pinkStrong,
    backgroundColor: colors.card,
    marginBottom: 8,
    gap: 2,
  },
  arrow: {
    fontSize: 20,
    lineHeight: 22,
    color: colors.pinkDeep,
    marginTop: -1,
  },
  label: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: colors.pinkDeep,
  },
  webCursor: { cursor: 'pointer' } as object,
});
