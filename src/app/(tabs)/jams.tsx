import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { addJamToCalendar } from '../../lib/calendar';
import { fetchEvents } from '../../lib/data';
import { describeSchedule, formatWhen, nextOccurrence } from '../../lib/schedule';
import { colors, space, type } from '../../lib/theme';
import type { JamEvent } from '../../lib/types';
import { Button, Card, Chip, Empty, Screen } from '../../lib/ui';

export default function Jams() {
  const [events, setEvents] = useState<JamEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setEvents(await fetchEvents());
    } catch {
      // keep what we had
    }
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const upcoming = useMemo(
    () =>
      events
        .map((e) => ({ event: e, occ: nextOccurrence(e, e.spot!.lat, e.spot!.lng) }))
        .filter((x) => x.occ)
        .sort((a, b) => a.occ!.start.getTime() - b.occ!.start.getTime()),
    [events],
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
        ListEmptyComponent={<Empty text="No jams yet. Add your weekly session so people can find it." />}
        renderItem={({ item: { event, occ } }) => (
          <Pressable accessibilityRole="button" onPress={() => router.push(`/spot/${event.spot_id}`)}>
            <Card>
              <Text style={[type.small, { color: occ!.happeningNow ? colors.grass : colors.coralDark, fontWeight: '700' }]}>
                {formatWhen(occ!)}
              </Text>
              <Text style={type.h2}>{event.name}</Text>
              <Text style={type.small}>
                {event.spot?.name} · {describeSchedule(event)}
              </Text>
              {event.disciplines.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                  {event.disciplines.map((d) => (
                    <Chip key={d} label={d} />
                  ))}
                </View>
              )}
              <View style={{ alignSelf: 'flex-start', marginTop: space.xs }}>
                <Button title="Add to calendar" variant="ghost" onPress={() => addJamToCalendar(event, occ!)} />
              </View>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}
