import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useAuth } from '../../lib/auth';
import { useOnJamsChanged } from '../../lib/events';
import { addJamToCalendar } from '../../lib/calendar';
import { fetchActiveLines, fetchEvents, fetchMyJamIds } from '../../lib/data';
import { JamThumb } from '../../lib/jamPhoto';
import { LineUpBadge } from '../../lib/lines';
import { describeSchedule, formatWhen, nextOccurrence } from '../../lib/schedule';
import { colors, radius, space, type } from '../../lib/theme';
import { MUSIC_LABEL, SLACKLINE, type JamEvent } from '../../lib/types';
import { Button, Card, Chip, Empty, Screen, Segmented } from '../../lib/ui';

type JamFilter = 'all' | 'mine' | 'dj' | 'music';

const FILTERS: { label: string; value: JamFilter }[] = [
  { label: 'All jams', value: 'all' },
  { label: 'My jams', value: 'mine' },
  { label: 'DJ', value: 'dj' },
  { label: 'Any music', value: 'music' },
];

function matches(e: JamEvent, f: JamFilter, mine: Set<string>) {
  if (f === 'mine') return mine.has(e.id);
  if (f === 'dj') return e.music === 'dj';
  if (f === 'music') return e.music === 'dj' || e.music === 'live' || e.music === 'speaker';
  return true;
}

export default function Jams() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<JamEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<JamFilter>('all');
  const [myJams, setMyJams] = useState<Set<string>>(new Set());
  const [lineSpots, setLineSpots] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [e, mine, lines] = await Promise.all([
        fetchEvents(),
        profile ? fetchMyJamIds(profile.id) : Promise.resolve(new Set<string>()),
        fetchActiveLines().catch(() => []),
      ]);
      setEvents(e);
      setMyJams(mine);
      setLineSpots(new Set(lines.map((l) => l.spot_id)));
    } catch {
      // keep what we had
    }
    setRefreshing(false);
  }, [profile?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useOnJamsChanged(load);

  const upcoming = useMemo(
    () =>
      events
        .filter((e) => matches(e, filter, myJams))
        .map((e) => ({ event: e, occ: nextOccurrence(e, e.spot!.lat, e.spot!.lng) }))
        .filter((x) => x.occ)
        .sort((a, b) => a.occ!.start.getTime() - b.occ!.start.getTime()),
    [events, filter, myJams],
  );

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable accessibilityRole="button" onPress={() => router.push('/event/new')} style={{ paddingHorizontal: space.lg, minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ color: colors.coralDark, fontWeight: '800', fontSize: 16 }}>+ Add jam</Text>
            </Pressable>
          ),
        }}
      />
      <FlatList
        data={upcoming}
        keyExtractor={(x) => x.event.id}
        contentContainerStyle={{ padding: space.lg, gap: space.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListHeaderComponent={<Segmented options={FILTERS} value={filter} onChange={setFilter} />}
        ListEmptyComponent={
          <Empty
            text={
              filter === 'all'
                ? 'No jams yet. Add your weekly session so people can find it.'
                : filter === 'mine'
                  ? 'You haven’t joined any jams yet. Open a jam and tap Join this jam.'
                  : 'No jams with that kind of music yet. Organizers can add music info with Edit on a jam.'
            }
          />
        }
        renderItem={({ item: { event, occ } }) => (
          <Pressable accessibilityRole="button" onPress={() => router.push(`/jam/${event.id}`)}>
            <Card>
              <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
                <JamThumb jam={event} size={64} />
                <Text style={[type.small, { flex: 1, color: occ!.happeningNow ? colors.grass : colors.coralDark, fontWeight: '700' }]}>
                  {formatWhen(occ!)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Text style={[type.h2, { flexShrink: 1 }]}>{event.name}</Text>
                {event.music && event.music !== 'none' && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      backgroundColor: event.music === 'dj' ? colors.dusk : colors.sand2,
                      paddingHorizontal: space.sm,
                      paddingVertical: 3,
                      borderRadius: radius.pill,
                    }}
                  >
                    <Ionicons name={event.music === 'dj' ? 'headset' : 'musical-notes'} size={14} color={event.music === 'dj' ? colors.white : colors.dusk} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: event.music === 'dj' ? colors.white : colors.dusk }}>
                      {MUSIC_LABEL[event.music]}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={type.small}>
                {event.spot?.name} · {describeSchedule(event)}
              </Text>
              <Text style={[type.small, { fontWeight: '700' }]}>
                {(() => {
                  const n = event.jam_members?.[0]?.count ?? 0;
                  return `${n} ${n === 1 ? 'member' : 'members'}${myJams.has(event.id) ? ' · You’re in' : ''}`;
                })()}
              </Text>
              {lineSpots.has(event.spot_id) &&
                (event.disciplines.includes(SLACKLINE) || (event.spot?.disciplines ?? []).includes(SLACKLINE)) && <LineUpBadge />}
              {event.disciplines.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                  {event.disciplines.map((d) => (
                    <Chip key={d} label={d} />
                  ))}
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xs }}>
                <Button title="Add to calendar" variant="ghost" onPress={() => addJamToCalendar(event, occ!)} />
                {/* Organizers edit their own jams; unclaimed (seeded) jams can be claimed by the first member who edits them. */}
                {(event.created_by === profile?.id || event.created_by == null) && (
                  <Button title="Edit" variant="ghost" onPress={() => router.push({ pathname: '/event/new', params: { id: event.id } })} />
                )}
              </View>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}
