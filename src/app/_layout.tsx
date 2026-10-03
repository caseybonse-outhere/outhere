import * as Notifications from 'expo-notifications';
import { router, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { AuthProvider, useAuth } from '../lib/auth';
import { registerForPush, syncHomeArea } from '../lib/device';
import { SUPPORT_EMAIL } from '../lib/legal';
import { isConfigured } from '../lib/supabase';
import { colors, space, type } from '../lib/theme';
import { Button } from '../lib/ui';

function Gate() {
  const { loading, session, profile, signOut } = useAuth();
  const segments = useSegments();
  const first = segments[0] as string | undefined;
  const lastResponse = Notifications.useLastNotificationResponse();

  const banned = !!profile?.banned_at;
  const member = !!profile && !!profile.terms_accepted_at && !banned;

  // Route people to sign-in, first-time setup (name + Terms), or the app. Legal pages are open to everyone.
  useEffect(() => {
    if (loading || banned || first === 'legal') return;
    if (!session) {
      if (first !== 'sign-in') router.replace('/sign-in');
    } else if (!member) {
      if (first !== 'welcome') router.replace('/welcome');
    } else if (first === 'sign-in' || first === 'welcome') {
      router.replace('/');
    }
  }, [loading, session, member, banned, first]);

  // Refresh the member's rough area and push token, without asking for permission at launch.
  // (The map asks for location when it opens; alerts ask for notifications when switched on.)
  const profileId = profile?.id;
  useEffect(() => {
    if (!member || !profileId) return;
    syncHomeArea(profileId, false);
    registerForPush(profileId, false);
  }, [member, profileId]);

  // Tapping an alert opens the spot it's about.
  useEffect(() => {
    const spotId = lastResponse?.notification.request.content.data?.spotId;
    if (member && typeof spotId === 'string') router.push(`/spot/${spotId}`);
  }, [lastResponse, member]);

  if (banned) {
    return (
      <View style={{ ...overlay, padding: space.xl, gap: space.lg }}>
        <Text style={[type.title, { textAlign: 'center' }]}>Account suspended</Text>
        <Text style={[type.body, { textAlign: 'center' }]}>
          This account was suspended for breaking the OUTHERENOW Terms or Community Guidelines.
        </Text>
        {SUPPORT_EMAIL ? <Text style={[type.small, { textAlign: 'center' }]}>Think this is a mistake? Email {SUPPORT_EMAIL}.</Text> : null}
        <Button title="Sign out" variant="secondary" onPress={signOut} />
      </View>
    );
  }

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
        <Stack.Screen name="legal/[doc]" options={{ title: '' }} />
        <Stack.Screen name="admin" options={{ title: 'Reports' }} />
        <Stack.Screen name="support" options={{ title: 'Contact support', presentation: 'modal' }} />
      </Stack>
      <Gate />
    </AuthProvider>
  );
}
