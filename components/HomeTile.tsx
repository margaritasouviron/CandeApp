import { Pressable, Text, StyleSheet, Platform } from 'react-native';
import { colors } from '../lib/theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
};

export function HomeTile({ label, onPress, variant = 'primary' }: Props) {
  return (
    <Pressable
      style={[styles.tile, variant === 'secondary' && styles.tileSecondary, Platform.OS === 'web' && styles.webCursor]}
      onPress={onPress}
    >
      <Text style={[styles.text, variant === 'secondary' && styles.textSecondary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.blue,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  tileSecondary: { backgroundColor: colors.brownLight, borderWidth: 2, borderColor: colors.border },
  text: { color: colors.white, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  textSecondary: { color: colors.blueDark },
  webCursor: { cursor: 'pointer' } as object,
});
