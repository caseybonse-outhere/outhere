import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Avatar } from './avatar';
import { postMenu } from './moderation';
import { PinMap, PinPicker, type LatLng, type Pin } from './pins';
import { formatTime, sunsetToday } from './schedule';
import { supabase } from './supabase';
import { colors, radius, space, type } from './theme';
import { LINE_TYPE_LABEL, type Line, type LineType } from './types';
import { Button, Card, Field, Segmented } from './ui';

type Until = '1h' | '2h' | '3h' | 'sunset';

export function describeLine(l: Line): string {
  return [LINE_TYPE_LABEL[l.line_type], l.length_ft ? `${l.length_ft} ft` : null].filter(Boolean).join(' · ');
}

/** Small green "The line is up" pill for cards and lists. */
export function LineUpBadge() {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        backgroundColor: colors.grass,
        paddingHorizontal: space.sm,
        paddingVertical: 3,
        borderRadius: radius.pill,
      }}
    >
      <Ionicons name="remove-outline" size={16} color={colors.white} />
      <Text style={{ fontSize: 13, fontWeight: '800', color: colors.white }}>The line is up</Text>
    </View>
  );
}

/**
 * "The line is up" card for a slackline spot: who rigged what, until when,
 * plus the form to post your own line or take it down.
 */
export function LineSection({
  spot,
  lines,
  userId,
  onChange,
}: {
  spot: { id: string; lat: number; lng: number; name?: string };
  lines: Line[];
  userId: string;
  onChange: () => void;
}) {
  const [posting, setPosting] = useState(false);
  const [lineType, setLineType] = useState<LineType>('slackline');
  const [length, setLength] = useState('');
  const [until, setUntil] = useState<Until>('2h');
  const [note, setNote] = useState('');
  const [pin, setPin] = useState<LatLng | null>(null);
  const [busy, setBusy] = useState(false);
  const mine = lines.find((l) => l.user_id === userId);
  const pinned: Pin[] = lines
    .filter((l) => l.pin_lat != null && l.pin_lng != null)
    .map((l) => ({ lat: l.pin_lat!, lng: l.pin_lng!, title: describeLine(l), description: `Rigged by ${l.profile?.display_name ?? 'a member'}` }));

  async function post() {
    const now = new Date();
    const hours = { '1h': 1, '2h': 2, '3h': 3 } as const;
    let ends = until === 'sunset' ? sunsetToday(spot.lat, spot.lng) : new Date(now.getTime() + hours[until] * 3600000);
    if (ends <= now) ends = new Date(now.getTime() + 3600000);
    const ft = parseInt(length, 10);
    setBusy(true);
    const { error } = await supabase.from('lines').insert({
      spot_id: spot.id,
      user_id: userId,
      line_type: lineType,
      length_ft: Number.isFinite(ft) && ft >= 5 ? ft : null,
      note: note.trim() || null,
      up_until: ends.toISOString(),
      pin_lat: pin?.lat ?? null,
      pin_lng: pin?.lng ?? null,
    });
    setBusy(false);
    if (error) return Alert.alert('Couldn’t post your line', error.message);
    setPosting(false);
    setLength('');
    setNote('');
    setPin(null);
    onChange();
  }

  function lineMenu(l: Line) {
    postMenu({ me: userId, ownerId: l.user_id, ownerName: l.profile?.display_name, targetType: 'line', targetId: l.id, what: 'line post', onBlocked: onChange });
  }

  async function takeDown() {
    if (!mine) return;
    await supabase.from('lines').delete().eq('id', mine.id);
    onChange();
  }

  return (
    <Card style={lines.length > 0 ? { borderColor: colors.grass, borderWidth: 2 } : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={type.h2}>Lines</Text>
        {lines.length > 0 && <LineUpBadge />}
      </View>

      {lines.length === 0 ? (
        <Text style={type.small}>No line rigged right now. Setting one up? Let people know.</Text>
      ) : (
        lines.map((l) => (
          <Pressable
            key={l.id}
            accessibilityRole="button"
            onPress={() => router.push(`/profile/${l.user_id}`)}
            onLongPress={() => lineMenu(l)}
            style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.md }}
          >
            <Avatar url={l.profile?.avatar_url} name={l.profile?.display_name} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={type.body}>
                <Text style={{ fontWeight: '700' }}>{describeLine(l)}</Text> · up until {formatTime(new Date(l.up_until))}
              </Text>
              <Text style={type.small}>
                Rigged by {l.profile?.display_name ?? 'a member'}
                {l.note ? ` — ${l.note}` : ''}
              </Text>
            </View>
            {l.user_id !== userId && (
              <Pressable accessibilityRole="button" accessibilityLabel="Report or block" onPress={() => lineMenu(l)} hitSlop={8} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="ellipsis-horizontal" size={20} color={colors.muted} />
              </Pressable>
            )}
          </Pressable>
        ))
      )}

      {pinned.length > 0 && <PinMap pins={pinned} height={160} />}

      {mine ? (
        <Button title="My line is down" variant="ghost" onPress={takeDown} />
      ) : posting ? (
        <View style={{ gap: space.md }}>
          <Text style={type.label}>What kind</Text>
          <Segmented<LineType>
            options={(Object.keys(LINE_TYPE_LABEL) as LineType[]).map((t) => ({ label: LINE_TYPE_LABEL[t], value: t }))}
            value={lineType}
            onChange={setLineType}
          />
          <Field label="Length in feet (optional)" value={length} onChangeText={(t) => setLength(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="e.g. 80" maxLength={4} />
          <Text style={type.label}>Up until</Text>
          <Segmented<Until>
            options={[
              { label: '1 hour', value: '1h' },
              { label: '2 hours', value: '2h' },
              { label: '3 hours', value: '3h' },
              { label: 'Sunset', value: 'sunset' },
            ]}
            value={until}
            onChange={setUntil}
          />
          <Field label="Note (optional)" value={note} onChangeText={setNote} maxLength={200} placeholder="Beginner-friendly, bring a harness, spare line…" />
          <Text style={type.label}>Where it’s rigged (optional)</Text>
          <PinPicker spot={{ lat: spot.lat, lng: spot.lng, name: spot.name ?? 'this spot' }} value={pin} onChange={setPin} hint="Tap the map to pin the line so people can find it." />
          <Button title="The line is up" onPress={post} loading={busy} />
          <Button title="Cancel" variant="ghost" onPress={() => setPosting(false)} />
        </View>
      ) : (
        <Button title="The line is up" onPress={() => setPosting(true)} />
      )}
    </Card>
  );
}
