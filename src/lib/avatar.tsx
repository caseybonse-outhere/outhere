import * as ImagePicker from 'expo-image-picker';
import { Image, Text, View } from 'react-native';
import { supabase } from './supabase';
import { colors } from './theme';

/** Round profile photo, or initials on coral when there's no photo. */
export function Avatar({ url, name, size = 40 }: { url?: string | null; name?: string | null; size?: number }) {
  const initials = (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        accessibilityLabel={name ? `${name}'s photo` : 'Profile photo'}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.sand2 }}
      />
    );
  }
  return (
    <View
      accessibilityLabel={name ? `${name}, no photo` : 'No photo'}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.dusk, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: colors.white, fontWeight: '800', fontSize: size * 0.38 }}>{initials || '?'}</Text>
    </View>
  );
}

/**
 * Let the member pick a square photo from their library and upload it to the avatars bucket.
 * Returns the new public URL, or null if they cancelled.
 */
export async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Photo access is off. Allow it for this app in the iPhone Settings app.');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.6,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const contentType = asset.mimeType ?? 'image/jpeg';
  const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;
  const body = await fetch(asset.uri).then((r) => r.arrayBuffer());

  const { error } = await supabase.storage.from('avatars').upload(path, body, { contentType });
  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', userId);
  return data.publicUrl;
}
