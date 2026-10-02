import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, useWindowDimensions } from 'react-native';
import { useAuth } from '../../lib/auth';
import { uploadImage } from '../../lib/images';
import { supabase } from '../../lib/supabase';
import { colors, radius, space } from '../../lib/theme';
import { Button, Field, Screen } from '../../lib/ui';

/** Caption + save step after taking or choosing a gallery photo. */
export default function NewPhoto() {
  const { uri, w, h } = useLocalSearchParams<{ uri: string; w: string; h: string }>();
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);

  const pw = Number(w) || 1;
  const ph = Number(h) || 1;
  const previewW = width - space.lg * 2;
  const previewH = Math.min(previewW * (ph / pw), 480);

  async function save() {
    if (!profile || !uri) return;
    setBusy(true);
    const path = `${profile.id}/gallery/${Date.now()}.jpg`;
    try {
      const url = await uploadImage('photos', path, uri);
      const { error } = await supabase.from('photos').insert({
        user_id: profile.id,
        storage_path: path,
        url,
        caption: caption.trim() || null,
        width: pw,
        height: ph,
      });
      if (error) {
        // e.g. the gallery hit 99 — don't leave an orphaned file behind.
        await supabase.storage.from('photos').remove([path]);
        throw error;
      }
      router.back();
    } catch (e) {
      Alert.alert('Couldn’t save photo', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={96}>
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 }} keyboardShouldPersistTaps="handled">
          {uri ? (
            <Image
              source={{ uri }}
              resizeMode="contain"
              accessibilityLabel="Photo preview"
              style={{ width: previewW, height: previewH, borderRadius: radius.lg, backgroundColor: colors.sand2 }}
            />
          ) : null}
          <Field label="Caption (optional)" value={caption} onChangeText={setCaption} maxLength={280} multiline placeholder="Where, who, what trick…" />
          <Button title="Add to gallery" onPress={save} loading={busy} />
          <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
