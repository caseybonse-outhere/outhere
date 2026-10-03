import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Avatar } from './avatar';
import { setGoing } from './data';
import { dayLabel, localDate, type Occurrence } from './schedule';
import { colors, radius, space, type } from './theme';
import type { Rsvp } from './types';
import { Button, Card } from './ui';

/** Sign-ups for one camp's next session. */
export function goingFor(rsvps: Rsvp[], eventId: string, occ: Occurrence | null): Rsvp[] {
  if (!occ) return [];
  const date = localDate(occ.start);
  return rsvps.filter((r) => r.event_id === eventId && r.occurs_on === date);
}

/** Small "8 going" pill for camp cards. */
export function GoingBadge({ count, mine }: { count: number; mine?: boolean }) {
  if (count === 0) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        backgroundColor: mine ? colors.coralDark : colors.sand2,
        paddingHorizontal: space.sm,
        paddingVertical: 3,
        borderRadius: radius.pill,
      }}
    >
      <Ionicons name="people" size={14} color={mine ? colors.white : colors.dusk} />
      <Text style={{ fontSize: 13, fontWeight: '800', color: mine ? colors.white : colors.dusk }}>
        {count} going{mine ? ' · you too' : ''}
      </Text>
    </View>
  );
}

/** "Going Wednesday" card on the camp page: who's coming to the next session, and an I'm-going toggle. */
export function GoingSection({
  eventId,
  occ,
  userId,
  going,
  onChange,
}: {
  eventId: string;
  occ: Occurrence;
  userId: string;
  going: Rsvp[];
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const mine = going.some((r) => r.user_id === userId);
  const day = dayLabel(occ.start);
  const when = occ.happeningNow ? 'now' : day;

  async function toggle() {
    setBusy(true);
    const { error } = await setGoing(eventId, userId, localDate(occ.start), !mine);
    setBusy(false);
    if (error && error.code !== '23505') return Alert.alert('Couldn’t update', error.message);
    onChange();
  }

  return (
    <Card style={mine ? { borderColor: colors.coralDark, borderWidth: 2 } : undefined}>
      <Text style={type.h2}>
        {going.length === 0 ? `Going ${when}` : `${going.length} going ${when}`}
      </Text>
      {going.length === 0 ? (
        <Text style={type.small}>No one has said they’re coming yet. Be the first so people know it’s on.</Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {going.map((r) => (
            <Pressable
              key={r.user_id}
              accessibilityRole="button"
              accessibilityLabel={r.profile?.display_name ?? 'Member'}
              onPress={() => router.push(`/profile/${r.user_id}`)}
              style={{ alignItems: 'center', width: 64, gap: 2 }}
            >
              <Avatar url={r.profile?.avatar_url} name={r.profile?.display_name} size={44} />
              <Text style={[type.small, { fontSize: 12 }]} numberOfLines={1}>
                {r.user_id === userId ? 'You' : r.profile?.display_name ?? 'Member'}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <Button
        title={mine ? 'You’re going ✓  Can’t make it?' : `I’m going ${day}`}
        variant={mine ? 'ghost' : 'primary'}
        onPress={toggle}
        loading={busy}
      />
    </Card>
  );
}
