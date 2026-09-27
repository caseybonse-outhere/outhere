import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { useAuth } from '../../lib/auth';
import { fetchSpots } from '../../lib/data';
import { DAY_NAMES } from '../../lib/schedule';
import { supabase } from '../../lib/supabase';
import { space, type } from '../../lib/theme';
import { DISCIPLINES, MUSIC_LABEL, type JamEvent, type Music, type Recurrence, type Spot, type StartType } from '../../lib/types';
import { Button, ChipGroup, Empty, Field, Screen, Segmented } from '../../lib/ui';

/** Accepts "16:00", "4pm", "4:30 PM". Returns "HH:MM" or null. */
function parseTime(input: string): string | null {
  const m = input.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Next date (YYYY-MM-DD) that falls on the given weekday, today included. */
function nextDateFor(dow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function NewJam() {
  // With ?id=… this screen edits an existing jam; otherwise it adds a new one.
  const params = useLocalSearchParams<{ spotId?: string; id?: string }>();
  const editingId = params.id;
  const { profile } = useAuth();
  const [spots, setSpots] = useState<Spot[]>([]);
  const [spotId, setSpotId] = useState(params.spotId ?? '');
  const [name, setName] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('weekly');
  const [day, setDay] = useState(new Date().getDay());
  const [startType, setStartType] = useState<StartType>('fixed');
  const [time, setTime] = useState('4:00 PM');
  const [offset, setOffset] = useState(0);
  const [duration, setDuration] = useState(180);
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [music, setMusic] = useState<Music | null>(null);
  const [existing, setExisting] = useState<JamEvent | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchSpots().then(setSpots).catch(() => {});
  }, []);

  // Load the jam being edited.
  useEffect(() => {
    if (!editingId) return;
    supabase
      .from('events')
      .select('*')
      .eq('id', editingId)
      .maybeSingle()
      .then(({ data }) => {
        const e = data as JamEvent | null;
        if (!e) return;
        setExisting(e);
        setSpotId(e.spot_id);
        setName(e.name);
        setRecurrence(e.recurrence);
        setDay(e.day_of_week);
        setStartType(e.start_type);
        if (e.start_time) setTime(e.start_time.slice(0, 5));
        setOffset(e.sunset_offset_min ?? 0);
        setDuration(e.duration_min);
        setDisciplines(e.disciplines ?? []);
        setDescription(e.description ?? '');
        setOrganizer(e.organizer ?? '');
        setMusic(e.music);
      });
  }, [editingId]);

  const parsed = parseTime(time);
  const valid = name.trim() && spotId && (startType === 'sunset' || parsed);

  async function save() {
    setBusy(true);
    const keepDate = existing?.start_date && existing.day_of_week === day && existing.recurrence === recurrence;
    const fields = {
      name: name.trim(),
      spot_id: spotId,
      recurrence,
      day_of_week: day,
      start_type: startType,
      start_time: startType === 'fixed' ? parsed : null,
      sunset_offset_min: startType === 'sunset' ? offset : 0,
      duration_min: duration,
      start_date: recurrence === 'weekly' ? null : keepDate ? existing!.start_date : nextDateFor(day),
      disciplines,
      description: description.trim() || null,
      organizer: organizer.trim() || null,
      music,
      created_by: profile!.id,
    };
    const { error } = editingId
      ? await supabase.from('events').update(fields).eq('id', editingId)
      : await supabase.from('events').insert(fields);
    setBusy(false);
    if (error) return Alert.alert('Couldn’t save jam', error.message);
    router.back();
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: editingId ? 'Edit jam' : 'Add a jam' }} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 }} keyboardShouldPersistTaps="handled">
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Wiggle Wednesdays" />

        <Text style={type.label}>Spot</Text>
        {spots.length === 0 ? (
          <Empty text="Add a spot on the map first." />
        ) : (
          <Segmented options={spots.map((s) => ({ label: s.name, value: s.id }))} value={spotId} onChange={setSpotId} />
        )}

        <Text style={type.label}>How often</Text>
        <Segmented<Recurrence>
          options={[
            { label: 'Weekly', value: 'weekly' },
            { label: 'Every other week', value: 'biweekly' },
            { label: 'One-off', value: 'once' },
          ]}
          value={recurrence}
          onChange={setRecurrence}
        />

        <Text style={type.label}>{recurrence === 'once' ? 'Day (the next one)' : 'Day'}</Text>
        <Segmented options={DAY_NAMES.map((d, i) => ({ label: d.slice(0, 3), value: i }))} value={day} onChange={setDay} />

        <Text style={type.label}>Starts</Text>
        <Segmented<StartType>
          options={[
            { label: 'At a set time', value: 'fixed' },
            { label: 'At sunset', value: 'sunset' },
          ]}
          value={startType}
          onChange={setStartType}
        />
        {startType === 'fixed' ? (
          <Field label="Start time" value={time} onChangeText={setTime} placeholder="4:00 PM" autoCapitalize="none" />
        ) : (
          <Segmented
            options={[
              { label: '30 min before', value: -30 },
              { label: 'At sunset', value: 0 },
              { label: '30 min after', value: 30 },
            ]}
            value={offset}
            onChange={setOffset}
          />
        )}
        {startType === 'fixed' && !parsed && <Text style={type.small}>Try a time like 4:00 PM or 16:00.</Text>}

        <Text style={type.label}>Runs for</Text>
        <Segmented options={[60, 120, 180, 240].map((m) => ({ label: `${m / 60} hr`, value: m }))} value={duration} onChange={setDuration} />

        <Text style={type.label}>Music</Text>
        <Segmented<Music | 'unknown'>
          options={[
            { label: 'Not sure', value: 'unknown' },
            ...(['dj', 'live', 'speaker', 'none'] as Music[]).map((m) => ({ label: MUSIC_LABEL[m], value: m })),
          ]}
          value={music ?? 'unknown'}
          onChange={(v) => setMusic(v === 'unknown' ? null : v)}
        />

        <Text style={type.label}>Disciplines</Text>
        <ChipGroup options={DISCIPLINES} value={disciplines} onChange={setDisciplines} />

        <Field label="Organizer (optional)" value={organizer} onChangeText={setOrganizer} />
        <Field label="Description (optional)" value={description} onChangeText={setDescription} multiline placeholder="What to bring, skill level, vibe…" />

        <Button title="Save jam" onPress={save} loading={busy} disabled={!valid} />
        {editingId && existing?.created_by === profile?.id && (
          <Button
            title="Delete jam"
            variant="danger"
            onPress={() =>
              Alert.alert('Delete this jam?', 'It will disappear for everyone.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    const { error } = await supabase.from('events').delete().eq('id', editingId);
                    if (error) Alert.alert('Couldn’t delete', error.message);
                    else router.back();
                  },
                },
              ])
            }
          />
        )}
      </ScrollView>
    </Screen>
  );
}
