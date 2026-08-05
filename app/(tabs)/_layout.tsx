import { Redirect, Tabs } from 'expo-router';
import { Platform, Text } from 'react-native';
import { useAuth } from '../../lib/auth';
import { colors } from '../../lib/theme';

function TabEmoji({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  const { session, loading } = useAuth();

  if (!loading && !session) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: Platform.OS === 'ios' ? 4 : 8,
          height: Platform.OS === 'ios' ? 88 : 64,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: () => <TabEmoji emoji="🏠" /> }} />
      <Tabs.Screen name="stats" options={{ title: 'Stats', tabBarIcon: () => <TabEmoji emoji="📊" /> }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendario', tabBarIcon: () => <TabEmoji emoji="📅" /> }} />
      <Tabs.Screen name="stock" options={{ title: 'Stock', tabBarIcon: () => <TabEmoji emoji="📦" /> }} />
      <Tabs.Screen name="bitacora" options={{ title: 'Bitácora', tabBarIcon: () => <TabEmoji emoji="📋" /> }} />
    </Tabs>
  );
}
