import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';
import { colors } from '../lib/theme';

type IconProps = { color: ColorValue; size?: number };

export function TabIconHome({ color, size = 22 }: IconProps) {
  return <Ionicons name="home-outline" size={size} color={color} />;
}
export function TabIconStats({ color, size = 22 }: IconProps) {
  return <Ionicons name="bar-chart-outline" size={size} color={color} />;
}
export function TabIconCalendar({ color, size = 22 }: IconProps) {
  return <Ionicons name="calendar-outline" size={size} color={color} />;
}
export function TabIconStock({ color, size = 22 }: IconProps) {
  return <Ionicons name="cube-outline" size={size} color={color} />;
}

export const tabColors = {
  active: colors.greenDark,
  inactive: colors.textMuted,
};
