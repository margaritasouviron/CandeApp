import { Pressable, Text, StyleSheet, Platform, View } from 'react-native';
import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppColors } from '../lib/ThemeModeProvider';
import { fonts } from '../lib/typography';
import type { AppColors } from '../lib/theme';

type Props = {
  label: string;
  onPress: () => void;
  bottomOffset?: number;
};

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      right: 16,
      left: undefined,
      zIndex: 100,
      elevation: 8,
    },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.fab,
      borderRadius: 999,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderWidth: 2,
      borderColor: colors.greenDark,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      maxWidth: 200,
    },
    plus: {
      fontFamily: fonts.title,
      fontSize: 20,
      color: colors.fabText,
      marginRight: 6,
    },
    label: {
      fontFamily: fonts.bodySemi,
      fontSize: 14,
      color: colors.fabText,
      flexShrink: 1,
    },
    webCursor: { cursor: 'pointer' } as object,
  });
}

export function FloatingActionButton({ label, onPress, bottomOffset = 88 }: Props) {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 12) + bottomOffset;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      <Pressable
        style={[styles.btn, Platform.OS === 'web' && styles.webCursor]}
        onPress={onPress}
      >
        <Text style={styles.plus}>+</Text>
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
      </Pressable>
    </View>
  );
}
