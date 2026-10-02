import * as Notifications from 'expo-notifications';
import { router, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { AuthProvider, useAuth } from '../lib/auth';
import { registerForPush, syncHomeArea } from '../lib/device';
import { isConfigured } from '../lib/supabase';
import { colors, space, type } from '../lib/theme';

function Gate() {
  const { loading, session, profile } = useAuth();
  const segments = useSegments();
  const first = segments[0] as string | undefined;
  const lastResponse = Notifications.useLastNotificationResponse();

  // Route people to sign-in, first-time profile setup, or the app.
  useEffect(() => {
    if (loading) return;
    if (!session) {
      if (first !== 'sign-in') router.replace('/sign-in');
    } else if (!profile) {
      if (first !== 'welcome') router.replace('/welcome');
    } else if (first === 'sign-in' || first === 'welcome') {
      router.replace('/');
    }
  }, [loading, session, profile, first]);

  // Once someone is a member, save their rough area and push token for nearby alerts.
  useEffect(() => {
    if (!profile) return;
    syncHomeArea(profile.id);
    registerForPush(profile.id);
  }, [profile?.id]);

  // Tapping an alert opens the spot it's about.
  useEffect(() => {
    const spotId = lastResponse?.notification.request.content.data?.spotId;
    if (profile && typeof spotId === 'string') router.push(`/spot/${spotId}`);
  }, [lastResponse, profile]);

  if (loading) {
    return (
      <View style={{ ...overlay }}>
        <ActivityIndicator color={colors.coral} size="large" />
      </View>
    );
  }
  return null;
}

const overlay = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  backgroundColor: colors.sand,
};

export default function RootLayout() {
  if (!isConfigured) {
    return (
      <View style={{ ...overlay, padding: space.xl, gap: space.md }}>
        <Text style={type.title}>Almost there</Text>
        <Text style={[type.body, { textAlign: 'center' }]}>
          Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to a .env file, then restart Expo. See README step 2.
        </Text>
      </View>
    );
  }

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.sand },
          headerTintColor: colors.dusk,
          headerTitleStyle: { fontWeight: '800', color: colors.night },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.sand },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="spot/[id]" options={{ title: '' }} />
        <Stack.Screen name="spot/new" options={{ title: 'Add a spot', presentation: 'modal' }} />
        <Stack.Screen name="camp/new" options={{ title: 'Camp', presentation: 'modal' }} />
        <Stack.Screen name="profile/[id]" options={{ title: '' }} />
        <Stack.Screen name="camp/[id]" options={{ title: '' }} />
      </Stack>
      <Gate />
    </AuthProvider>
  );
}
