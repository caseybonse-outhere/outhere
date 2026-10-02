import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useAuth } from '../../lib/auth';
import { Avatar } from '../../lib/avatar';
import { addJamToCalendar } from '../../lib/calendar';
import { fetchActiveLines, fetchJamMembers } from '../../lib/data';
import { JamThumb } from '../../lib/jamPhoto';
import { LineSection } from '../../lib/lines';
import { describeSchedule, formatWhen, nextOccurrence } from '../../lib/schedule';
import { supabase } from '../../lib/supabase';
import { colors, radius, space, type } from '../../lib/theme';
import { MUSIC_LABEL, SLACKLINE, type JamEvent, type JamMember, type Line } from '../../lib/types';
import { Button, Card, Chip, Empty, Screen } from '../../lib/ui';

export default function JamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const [jam, setJam] = useState<JamEvent | null>(null);
  const [members, setMembers] = useState<JamMember[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('events')
      .select('*, spot:spots(id, name, lat, lng, address, disciplines)')
      .eq('id', id)
      .maybeSingle();
    const e = data as JamEvent | null;
    setJam(e);
    setLoaded(true);
    if (!e) return;
    const [m, l] = await Promise.all([fetchJamMembers(id), fetchActiveLines(e.spot_id).catch(() => [] as Line[])]);
    setMembers(m);
    setLines(l);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
    }, [load]),
  );

  if (!jam || !jam.spot || !profile) {
    return (
      <Screen style={{ padding: space.xl }}>
        <Empty text={loaded ? 'This jam isn’t around anymore.' : 'Loading…'} />
      </Screen>
    );
  }

  const spot = jam.spot;
  const occ = nextOccurrence(jam, spot.lat, spot.lng);
  const me = members.find((m) => m.user_id === profile.id);
  const slackliney = jam.disciplines.includes(SLACKLINE) || (spot.disciplines ?? []).includes(SLACKLINE);
  const canEdit = jam.created_by === profile.id || jam.created_by == null;

  async function join() {
    setBusy(true);
    const { error } = await supabase.from('jam_members').insert({ event_id: jam!.id, user_id: profile!.id, role: 'member' });
    setBusy(false);
    if (error) return Alert.alert('Couldn’t join', error.message);
    load();
  }

  function leave() {
    if (me?.role === 'organizer') {
      return Alert.alert('You organize this jam', 'Organizers stay in the community. To stop running it, delete the jam from Edit.');
    }
    Alert.alert(`Leave ${jam!.name}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('jam_members').delete().eq('event_id', jam!.id).eq('user_id', profile!.id);
          load();
        },
      },
    ]);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: jam.name }} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 }}>
        {/* Cover */}
        {jam.cover_url ? (
          <Image
            source={{ uri: jam.cover_url }}
            accessibilityLabel={`${jam.name} photo`}
            style={{ width: width - space.lg * 2, height: Math.round((width - space.lg * 2) * 0.66), borderRadius: radius.lg, backgroundColor: colors.sand2 }}
          />
        ) : (
          <JamThumb jam={jam} size={88} />
        )}

        {/* Header */}
        <View style={{ gap: space.xs }}>
          {occ && (
            <Text style={[type.body, { color: occ.happeningNow ? colors.grass : colors.coralDark, fontWeight: '800' }]}>{formatWhen(occ)}</Text>
          )}
          <Text style={type.title}>{jam.name}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push(`/spot/${spot.id}`)} style={{ minHeight: 32, justifyContent: 'center' }}>
            <Text style={[type.body, { color: colors.dusk, fontWeight: '700' }]}>
              <Ionicons name="location" size={16} color={colors.dusk} /> {spot.name} ›
            </Text>
          </Pressable>
          <Text style={type.small}>
            {describeSchedule(jam)}
            {jam.music && jam.music !== 'none' ? ` · ${MUSIC_LABEL[jam.music]}` : ''}
          </Text>
          {jam.disciplines.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs }}>
              {jam.disciplines.map((d) => (
                <Chip key={d} label={d} />
              ))}
            </View>
          )}
        </View>

        {jam.description ? (
          <Card>
            <Text style={type.body}>{jam.description}</Text>
          </Card>
        ) : null}

        {/* Membership */}
        <Card>
          <Text style={type.h2}>
            Community · {members.length} {members.length === 1 ? 'member' : 'members'}
          </Text>
          <Text style={type.small}>
            {me
              ? me.role === 'organizer'
                ? 'You organize this jam.'
                : 'You’re part of this jam.'
              : 'Join to show you’re a regular and find the crew.'}
          </Text>
          {me ? (
            me.role !== 'organizer' && <Button title="Leave jam" variant="ghost" onPress={leave} />
          ) : (
            <Button title="Join this jam" onPress={join} loading={busy} />
          )}
          {members.map((m) => (
            <Pressable
              key={m.user_id}
              accessibilityRole="button"
              onPress={() => router.push(`/profile/${m.user_id}`)}
              style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.md }}
            >
              <Avatar url={m.profile?.avatar_url} name={m.profile?.display_name} size={36} />
              <Text style={[type.body, { flex: 1, fontWeight: m.role === 'organizer' ? '700' : '400' }]}>
                {m.profile?.display_name ?? 'Member'}
                {m.user_id === profile.id ? ' (you)' : ''}
              </Text>
              {m.role === 'organizer' && <Text style={[type.small, { fontWeight: '700' }]}>Organizer</Text>}
            </Pressable>
          ))}
          {members.length === 0 && <Empty text="No members yet. Be the first." />}
        </Card>

        {slackliney && <LineSection spot={spot} lines={lines} userId={profile.id} onChange={load} />}

        {/* Actions */}
        <View style={{ gap: space.sm }}>
          {occ && <Button title="Add to calendar" variant="secondary" onPress={() => addJamToCalendar(jam, occ)} />}
          {canEdit && <Button title="Edit jam" variant="ghost" onPress={() => router.push({ pathname: '/event/new', params: { id: jam.id } })} />}
        </View>
      </ScrollView>
    </Screen>
  );
}
