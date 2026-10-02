import { Image, Text, View } from 'react-native';
import { chooseSource, pickImage, uploadImage } from './images';
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
 * Let the member take or pick a square photo and upload it to the avatars bucket.
 * Returns the new public URL, or null if they cancelled.
 */
export async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  const source = await chooseSource('Profile photo');
  if (!source) return null;
  const img = await pickImage(source, { square: true, maxSize: 600 });
  if (!img) return null;
  const url = await uploadImage('avatars', `${userId}/${Date.now()}.jpg`, img.uri);
  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId);
  if (error) throw error;
  return url;
}
