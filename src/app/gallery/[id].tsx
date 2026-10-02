import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../../lib/auth';
import { fetchPhotos } from '../../lib/data';
import { PhotoGrid, startAddPhoto } from '../../lib/gallery';
import { supabase } from '../../lib/supabase';
import { space, type } from '../../lib/theme';
import { MAX_PHOTOS, type Photo } from '../../lib/types';
import { Button, Empty, Screen } from '../../lib/ui';

/** Everyone's full gallery: /gallery/<user id>. */
export default function GalleryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [total, setTotal] = useState(0);
  const [name, setName] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const isMe = profile?.id === id;

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [{ photos: p, total: t }, { data }] = await Promise.all([
        fetchPhotos(id),
        supabase.from('profiles').select('display_name').eq('id', id).maybeSingle(),
      ]);
      setPhotos(p);
      setTotal(t);
      setName((data as { display_name: string } | null)?.display_name ?? '');
    } catch {
      // keep what we had
    }
    setRefreshing(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <Screen>
      <Stack.Screen options={{ title: isMe ? 'My gallery' : name ? `${name}’s gallery` : 'Gallery' }} />
      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl * 2 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={type.small}>{isMe ? `${total} of ${MAX_PHOTOS} photos` : `${total} ${total === 1 ? 'photo' : 'photos'}`}</Text>
          {isMe && <Button title="Add photo" onPress={() => startAddPhoto(total)} disabled={total >= MAX_PHOTOS} />}
        </View>
        {photos.length === 0 ? <Empty text="No photos yet." /> : <PhotoGrid photos={photos} />}
      </ScrollView>
    </Screen>
  );
}
