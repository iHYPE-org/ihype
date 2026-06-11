import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { WorkbenchProvider } from '@/context/WorkbenchContext';

function Icon({ label, focused }: { label: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.4 }}>{label}</Text>;
}

export default function TabLayout() {
  return (
    <WorkbenchProvider>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#0a0a0a', borderTopColor: '#1a1a1a' },
        tabBarActiveTintColor: '#ff5029',
        tabBarInactiveTintColor: '#555',
        tabBarLabelStyle: { fontSize: 10, letterSpacing: 1, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'HOME',
          tabBarIcon: ({ focused }) => <Icon label="⚡" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'DISCOVER',
          tabBarIcon: ({ focused }) => <Icon label="🔍" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: 'TICKETS',
          tabBarIcon: ({ focused }) => <Icon label="🎟" focused={focused} />,
        }}
      />
    </Tabs>
    </WorkbenchProvider>
  );
}
