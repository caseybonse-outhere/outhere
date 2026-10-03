import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { ActionSheetIOS, Alert, Linking, Platform } from 'react-native';
import { supabase } from './supabase';

export type PhotoSource = 'camera' | 'library';
export type PickedImage = { uri: string; width: number; height: number };

/** Ask "Take photo / Choose from library". Resolves null on cancel. */
export function chooseSource(title = 'Add a photo'): Promise<PhotoSource | null> {
  return new Promise((resolve) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title, options: ['Take photo', 'Choose from library', 'Cancel'], cancelButtonIndex: 2 },
        (i) => resolve(i === 0 ? 'camera' : i === 1 ? 'library' : null),
      );
    } else {
      Alert.alert(title, undefined, [
        { text: 'Take photo', onPress: () => resolve('camera') },
        { text: 'Choose from library', onPress: () => resolve('library') },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ]);
    }
  });
}

function permissionAlert(what: string) {
  Alert.alert(`${what} access is off`, `Allow ${what.toLowerCase()} access for this app in the iPhone Settings app.`, [
    { text: 'Not now', style: 'cancel' },
    { text: 'Open Settings', onPress: () => Linking.openSettings() },
  ]);
}

/**
 * Take or pick a photo, then shrink it so uploads stay fast and small.
 * `square` crops to 1:1 (avatars, jam thumbnails look best that way).
 */
export async function pickImage(source: PhotoSource, opts: { square?: boolean; maxSize?: number } = {}): Promise<PickedImage | null> {
  const { square = false, maxSize = 1600 } = opts;

  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      permissionAlert('Camera');
      return null;
    }
  } else {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      permissionAlert('Photo');
      return null;
    }
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: square,
    aspect: square ? [1, 1] : undefined,
    quality: 1,
  };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const landscape = asset.width >= asset.height;
  const needsResize = Math.max(asset.width, asset.height) > maxSize;
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (needsResize) ctx.resize(landscape ? { width: maxSize } : { height: maxSize });
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/** Upload a local JPEG to a public bucket and return its public URL. */
export async function uploadImage(bucket: 'avatars' | 'photos', path: string, uri: string): Promise<string> {
  const body = await fetch(uri).then((r) => r.arrayBuffer());
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType: 'image/jpeg' });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Storage path from a public URL in our photos bucket (for deleting files). */
export function storagePathFromUrl(url: string, bucket: 'avatars' | 'photos'): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length));
}

/** Every file path under a folder in a bucket (folders come back from list() with no id). */
async function listAll(bucket: string, folder: string): Promise<string[]> {
  const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: 1000 });
  if (error || !data) return [];
  const paths: string[] = [];
  for (const item of data) {
    const path = `${folder}/${item.name}`;
    if (item.id) paths.push(path);
    else paths.push(...(await listAll(bucket, path)));
  }
  return paths;
}

/** Delete everything this member uploaded (profile and camp photos). Used when deleting an account. */
export async function deleteMyFiles(userId: string): Promise<void> {
  for (const bucket of ['avatars', 'photos']) {
    const paths = await listAll(bucket, userId);
    if (paths.length) await supabase.storage.from(bucket).remove(paths);
  }
}
