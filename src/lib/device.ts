import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Round to ~1 km so we never store anyone's precise location. */
const fuzz = (n: number) => Math.round(n * 100) / 100;

export async function getApproxLocation(): Promise<{ lat: number; lng: number } | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

/** Save the member's approximate area so nearby-jam alerts know who to notify. */
export async function syncHomeArea(userId: string): Promise<void> {
  try {
    const loc = await getApproxLocation();
    if (!loc) return;
    await supabase.from('profiles').update({ home_lat: fuzz(loc.lat), home_lng: fuzz(loc.lng) }).eq('id', userId);
  } catch {
    // Location is optional; alerts simply won't reach this member.
  }
}

/**
 * Ask for notification permission and save this device's Expo push token.
 * Needs an EAS project ID (run `npx eas-cli@latest init` once) and a real device.
 */
export async function registerForPush(userId: string): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return null;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
    return token;
  } catch {
    return null;
  }
}
