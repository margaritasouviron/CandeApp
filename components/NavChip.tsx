import { Pressable, Text, StyleSheet, Platform, ViewStyle } from 'react-native';
import { useMemo } from 'react';
import { useAppColors } from '../lib/ThemeModeProvider';
import { radii, type AppColors } from '../lib/theme';
import { fonts } from '../lib/typography';

type Variant = 'rose' | 'blush' | 'mint' | 'magenta';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  /** Fila de 3 en home vs botón único centrado */
  layout?: 'tile' | 'solo';
};

function variantStyle(colors: AppColors, variant: Variant): { box: ViewStyle; text: { color: string } } {
  const map: Record<Variant, { box: ViewStyle; text: { color: string } }> = {
    magenta: { box: { backgroundColor: colors.pinkDeep }, text: { color: colors.fabText } },
    rose: { box: { backgroundColor: colors.pinkStrong }, text: { color: colors.fabText } },
    blush: { box: { backgroundColor: colors.pink }, text: { color: colors.text } },
    mint: { box: { backgroundColor: colors.greenDark }, text: { color: colors.fabText } },
  };
  return map[variant];
}

export function NavChip({ label, onPress, variant = 'blush', layout = 'tile' }: Props) {
  const colors = useAppColors();
  const v = useMemo(() => variantStyle(colors, variant), [colors, variant]);
  return (
    <Pressable
      style={[
        styles.chip,
        layout === 'solo' && styles.chipSolo,
        layout === 'tile' && styles.chipTile,
        v.box,
        Platform.OS === 'web' && styles.webCursor,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.text, v.text]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radii.pill,
    paddingVertical: 7,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipTile: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 4,
    marginBottom: 8,
  },
  chipSolo: {
    alignSelf: 'center',
    paddingHorizontal: 28,
    marginTop: 2,
    marginBottom: 4,
  },
  text: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    textAlign: 'center',
  },
  webCursor: { cursor: 'pointer' } as object,
});
