import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/tabs';
import { colors } from '../../lib/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.sand },
        headerTitleStyle: { fontWeight: '800', color: colors.night },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.coralDark,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.sand, borderTopColor: colors.line },
        sceneStyle: { backgroundColor: colors.sand },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Map',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="map" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="camps"
        options={{
          title: 'Camps',
          tabBarIcon: ({ color, size }) => <Ionicons name="bonfire" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: 'Me',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
