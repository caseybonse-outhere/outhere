import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useAuth } from '../../lib/auth';
import { Avatar } from '../../lib/avatar';
import { report } from '../../lib/data';
import { supabase } from '../../lib/supabase';
import { colors, space, type } from '../../lib/theme';
import { PUBLIC_PROFILE_COLUMNS, type Photo, type PublicProfile } from '../../lib/types';
import { Button, Empty, Screen } from '../../lib/ui';

export default function PhotoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [owner, setOwner] = useState<PublicProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('photos').select('*').eq('id', id).maybeSingle();
      const p = data as Photo | null;
      setPhoto(p);
      setLoaded(true);
      if (p) {
        const { data: o } = await supabase.from('profiles').select(PUBLIC_PROFILE_COLUMNS).eq('id', p.user_id).maybeSingle();
        setOwner(o as PublicProfile | null);
      }
    })();
  }, [id]);

  if (!photo || !profile) {
    return (
      <Screen style={{ padding: space.xl }}>
        <Empty text={loaded ? 'This photo was removed.' : 'Loading…'} />
      </Screen>
    );
  }

  const isMine = photo.user_id === profile.id;
  const ratio = photo.width && photo.height ? photo.height / photo.width : 1;
  const imgH = Math.min(width * ratio, 640);

  function remove() {
    Alert.alert('Delete this photo?', 'It will be removed from your gallery.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('photos').delete().eq('id', photo!.id);
          if (error) return Alert.alert('Couldn’t delete', error.message);
          await supabase.storage.from('photos').remove([photo!.storage_path]);
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: '' }} />
      <ScrollView contentContainerStyle={{ paddingBottom: space.xxl * 2 }}>
        <Image
          source={{ uri: photo.url }}
          resizeMode="contain"
          accessibilityLabel={photo.caption ?? 'Photo'}
          style={{ width, height: imgH, backgroundColor: colors.night }}
        />
        <View style={{ padding: space.lg, gap: space.md }}>
          {owner && (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/profile/${owner.id}`)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 }}
            >
              <Avatar url={owner.avatar_url} name={owner.display_name} size={32} />
              <Text style={[type.body, { fontWeight: '700' }]}>{owner.display_name}</Text>
              <Text style={type.small}>· {new Date(photo.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
            </Pressable>
          )}
          {photo.caption ? <Text style={type.body}>{photo.caption}</Text> : null}
          {isMine ? (
            <Button title="Delete photo" variant="danger" onPress={remove} />
          ) : (
            <Button
              title="Report photo"
              variant="ghost"
              onPress={async () => {
                await report(profile.id, 'photo', photo.id);
                Alert.alert('Thanks — we’ll take a look.');
              }}
            />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
