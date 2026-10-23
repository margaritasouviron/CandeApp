import { Redirect, Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useAuth } from '../../lib/auth';
import {
  TabIconCalendar,
  TabIconHome,
  TabIconStats,
  TabIconStock,
  tabColors,
} from '../../components/TabIcons';
import { colors } from '../../lib/theme';
import { fonts } from '../../lib/typography';

export default function TabsLayout() {
  const { session, loading } = useAuth();

  if (!loading && !session) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tabColors.active,
        tabBarInactiveTintColor: tabColors.inactive,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 2,
          paddingBottom: Platform.OS === 'ios' ? 4 : 8,
          height: Platform.OS === 'ios' ? 88 : 64,
        },
        tabBarLabelStyle: { fontFamily: fonts.bodySemi, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color }) => <TabIconHome color={color} /> }}
      />
      <Tabs.Screen
        name="stats"
        options={{ title: 'Stats', tabBarIcon: ({ color }) => <TabIconStats color={color} /> }}
      />
      <Tabs.Screen
        name="calendar"
        options={{ title: 'Calendario', tabBarIcon: ({ color }) => <TabIconCalendar color={color} /> }}
      />
      <Tabs.Screen
        name="stock"
        options={{ title: 'Stock', tabBarIcon: ({ color }) => <TabIconStock color={color} /> }}
      />
      <Tabs.Screen name="bitacora" options={{ href: null }} />
    </Tabs>
  );
}
