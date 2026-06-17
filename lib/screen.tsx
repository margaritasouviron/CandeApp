import { type ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppLayout } from './layout';
import { colors } from './theme';

type ScreenProps = {
  children: ReactNode;
  style?: ViewStyle;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  centered?: boolean;
};

export function Screen({ children, style, edges = ['top', 'left', 'right'], centered = true }: ScreenProps) {
  const { isWeb, contentMaxWidth } = useAppLayout();

  const content = isWeb && centered && contentMaxWidth ? (
    <View style={[styles.webFrame, { maxWidth: contentMaxWidth }]}>{children}</View>
  ) : (
    children
  );

  return (
    <SafeAreaView edges={edges} style={[styles.safe, isWeb && styles.safeWeb, style]}>
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeWeb: {
    ...(Platform.OS === 'web'
      ? ({
          minHeight: '100vh',
          width: '100%',
          alignItems: 'center',
        } as object)
      : null),
  },
  webFrame: {
    flex: 1,
    width: '100%',
    ...(Platform.OS === 'web'
      ? ({
          minHeight: '100vh',
        } as object)
      : null),
  },
});
