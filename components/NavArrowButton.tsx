import { Pressable, Text, StyleSheet, Platform } from 'react-native';
import { colors } from '../lib/theme';

type Props = {
  direction: 'prev' | 'next';
  onPress: () => void;
  size?: 'sm' | 'md';
};

export function NavArrowButton({ direction, onPress, size = 'sm' }: Props) {
  const dim = size === 'sm' ? 30 : 36;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={[
        styles.btn,
        { width: dim, height: dim, borderRadius: size === 'sm' ? 8 : 10 },
        Platform.OS === 'web' && styles.webCursor,
      ]}
    >
      <Text style={[styles.glyph, size === 'md' && styles.glyphMd]}>{direction === 'prev' ? '‹' : '›'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.pinkStrong,
  },
  glyph: {
    fontSize: 20,
    lineHeight: 22,
    color: colors.pinkDeep,
    fontWeight: '400',
    marginTop: -2,
  },
  glyphMd: { fontSize: 24, lineHeight: 26 },
  webCursor: { cursor: 'pointer' } as object,
});
