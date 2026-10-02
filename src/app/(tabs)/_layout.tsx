import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/tabs';
import { useAuth } from '../../lib/auth';
import { useMessageStream, useUnreadCount } from '../../lib/messages';
import { colors } from '../../lib/theme';

export default function TabsLayout() {
  const { profile } = useAuth();
  useMessageStream(profile?.id);
  const unread = useUnreadCount(profile?.id);

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
        name="jams"
        options={{
          title: 'Jams',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.coralDark },
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" color={color} size={size} />,
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
