import { router } from 'expo-router';
import { Alert, Image, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { chooseSource, pickImage } from './images';
import { colors, radius, space, type } from './theme';
import { MAX_PHOTOS, type Photo } from './types';
import { Button, Card, Empty } from './ui';

/** Square photo tiles. `inset` is the horizontal padding around the grid, used to size tiles. */
export function PhotoGrid({ photos, columns = 3, inset = space.lg * 2 }: { photos: Photo[]; columns?: number; inset?: number }) {
  const { width } = useWindowDimensions();
  const gap = 4;
  const size = Math.floor((width - inset - gap * (columns - 1)) / columns);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {photos.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="imagebutton"
          accessibilityLabel={p.caption ? `Photo: ${p.caption}` : 'Photo'}
          onPress={() => router.push(`/photo/${p.id}`)}
        >
          <Image source={{ uri: p.url }} style={{ width: size, height: size, borderRadius: radius.sm, backgroundColor: colors.sand2 }} />
        </Pressable>
      ))}
    </View>
  );
}

/** Take or choose a photo, then open the caption screen. Enforces the 99-photo cap up front. */
export async function startAddPhoto(total: number) {
  if (total >= MAX_PHOTOS) {
    Alert.alert('Your gallery is full', `You can keep up to ${MAX_PHOTOS} photos. Delete one to add another.`);
    return;
  }
  const source = await chooseSource('Add to your gallery');
  if (!source) return;
  try {
    const img = await pickImage(source, { maxSize: 1600 });
    if (!img) return;
    router.push({ pathname: '/photo/new', params: { uri: img.uri, w: String(img.width), h: String(img.height) } });
  } catch (e) {
    Alert.alert('Couldn’t get that photo', e instanceof Error ? e.message : String(e));
  }
}

/** Gallery preview card used on the Me tab and on profiles. */
export function GalleryCard({
  userId,
  photos,
  total,
  isMe,
  name,
}: {
  userId: string;
  photos: Photo[];
  total: number;
  isMe: boolean;
  name?: string;
}) {
  if (!isMe && total === 0) return null;
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text style={type.h2}>{isMe ? 'My gallery' : 'Gallery'}</Text>
        <Text style={type.small}>{isMe ? `${total} / ${MAX_PHOTOS}` : `${total} ${total === 1 ? 'photo' : 'photos'}`}</Text>
      </View>
      {photos.length > 0 ? (
        <PhotoGrid photos={photos} inset={space.lg * 4} />
      ) : (
        <Empty text={isMe ? 'Show what you do — add photos from sessions and jams.' : `${name ?? 'They'} hasn’t added photos yet.`} />
      )}
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        {isMe && <Button title="Add photo" onPress={() => startAddPhoto(total)} disabled={total >= MAX_PHOTOS} />}
        {total > photos.length && <Button title={`See all ${total}`} variant="ghost" onPress={() => router.push(`/gallery/${userId}`)} />}
      </View>
    </Card>
  );
}
