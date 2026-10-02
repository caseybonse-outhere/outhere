import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { space, type } from '../../lib/theme';
import { DISCIPLINES, type Spot } from '../../lib/types';
import { Button, ChipGroup, Field, Screen, Segmented } from '../../lib/ui';

export default function NewSpot() {
  const { lat, lng } = useLocalSearchParams<{ lat: string; lng: string }>();
  const { profile } = useAuth();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [features, setFeatures] = useState('');
  const [surface, setSurface] = useState('Grass');
  const [fire, setFire] = useState<Spot['fire_allowed']>('unknown');
  const [lighting, setLighting] = useState<Spot['lighting']>('unknown');
  const [isPublic, setIsPublic] = useState(true);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { data, error } = await supabase
      .from('spots')
      .insert({
        name: name.trim(),
        address: address.trim() || null,
        lat: Number(lat),
        lng: Number(lng),
        disciplines,
        features: features.trim() || null,
        surface,
        fire_allowed: fire,
        lighting,
        is_public: isPublic,
        notes: notes.trim() || null,
        created_by: profile!.id,
      })
      .select('id')
      .single();
    setBusy(false);
    if (error) return Alert.alert('Couldn’t save spot', error.message);
    router.replace(`/spot/${data.id}`);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 }} keyboardShouldPersistTaps="handled">
        <Text style={type.small}>
          Pinned at {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
        </Text>
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. The big eucalyptus at Clover Park" />
        <Field label="Address or directions (optional)" value={address} onChangeText={setAddress} />
        <Text style={type.label}>Good for</Text>
        <ChipGroup options={DISCIPLINES} value={disciplines} onChange={setDisciplines} />
        <Field label="Features" value={features} onChangeText={setFeatures} multiline placeholder="Anchor trees, span length, rails, shade, mats…" />
        <Text style={type.label}>Surface</Text>
        <Segmented options={['Grass', 'Sand', 'Concrete', 'Wood', 'Trail', 'Mixed'].map((v) => ({ label: v, value: v }))} value={surface} onChange={setSurface} />
        <Text style={type.label}>Fire</Text>
        <Segmented<Spot['fire_allowed']>
          options={[
            { label: 'Allowed', value: 'yes' },
            { label: 'Not allowed', value: 'no' },
            { label: 'Permit', value: 'permit' },
            { label: 'Not sure', value: 'unknown' },
          ]}
          value={fire}
          onChange={setFire}
        />
        <Text style={type.label}>Lighting at night</Text>
        <Segmented<Spot['lighting']>
          options={[
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' },
            { label: 'Not sure', value: 'unknown' },
          ]}
          value={lighting}
          onChange={setLighting}
        />
        <Text style={type.label}>Who can see it</Text>
        <Segmented<'public' | 'private'>
          options={[
            { label: 'All members', value: 'public' },
            { label: 'Just me', value: 'private' },
          ]}
          value={isPublic ? 'public' : 'private'}
          onChange={(v) => setIsPublic(v === 'public')}
        />
        <Field label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Parking, etiquette, best times…" />
        <Button title="Save spot" onPress={save} loading={busy} disabled={!name.trim() || disciplines.length === 0} />
      </ScrollView>
    </Screen>
  );
}
