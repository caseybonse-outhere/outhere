import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../../lib/auth';
import { emitJamsChanged, useOnJamsChanged } from '../../lib/events';
import { Avatar } from '../../lib/avatar';
import { addJamToCalendar } from '../../lib/calendar';
import { fetchActiveLines, fetchActiveSessions, fetchEvents, fetchReviews } from '../../lib/data';
import { postMenu, reportContent, ReportLink } from '../../lib/moderation';
import { JamThumb } from '../../lib/jamPhoto';
import { LineSection } from '../../lib/lines';
import { shareLink, showQr } from '../../lib/share';
import { describeSchedule, formatTime, formatWhen, nextOccurrence, sunsetToday } from '../../lib/schedule';
import { supabase } from '../../lib/supabase';
import { colors, space, type } from '../../lib/theme';
import { MUSIC_LABEL, SLACKLINE, type JamEvent, type Line, type Review, type Session, type Spot } from '../../lib/types';
import { Button, Card, Chip, Empty, Field, Screen, Segmented } from '../../lib/ui';

const FIRE_LABEL = { yes: 'Fire OK', no: 'No fire', permit: 'Fire with permit', unknown: 'Fire rules unknown' };
const LIGHT_LABEL = { yes: 'Lit at night', no: 'No lighting', unknown: 'Lighting unknown' };

type Until = '1h' | '2h' | '3h' | 'sunset';

export default function SpotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [spot, setSpot] = useState<Spot | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [events, setEvents] = useState<JamEvent[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [checkingIn, setCheckingIn] = useState(false);
  const [activity, setActivity] = useState<string | null>(null);
  const [until, setUntil] = useState<Until>('2h');
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('spots').select('*').eq('id', id).maybeSingle();
    setSpot(data as Spot | null);
    const [s, e, r, l] = await Promise.all([
      fetchActiveSessions(id),
      fetchEvents(id),
      fetchReviews(id),
      fetchActiveLines(id).catch(() => [] as Line[]),
    ]);
    setSessions(s);
    setEvents(e);
    setReviews(r);
    setLines(l);
    const mine = r.find((x) => x.user_id === profile?.id);
    if (mine) {
      setRating(mine.rating);
      setReviewText(mine.body ?? '');
    }
  }, [id, profile?.id]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
    }, [load]),
  );
  useOnJamsChanged(() => load().catch(() => {}));

  const avg = useMemo(() => (reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : null), [reviews]);
  const mySession = sessions.find((s) => s.user_id === profile?.id);

  if (!spot || !profile) {
    return (
      <Screen style={{ padding: space.xl }}>
        <Empty text="Loading spot…" />
      </Screen>
    );
  }
  const s = spot;

  function confirmDelete() {
    const n = events.length;
    const extra = n > 0 ? ` Its ${n} ${n === 1 ? 'camp' : 'camps'}, reviews, check-ins and lines will be deleted too.` : ' Its reviews, check-ins and lines will be deleted too.';
    Alert.alert(`Delete ${s.name}?`, `This removes the spot for everyone and can’t be undone.${extra}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { data, error } = await supabase.from('spots').delete().eq('id', s.id).select('id');
          if (error) return Alert.alert('Couldn’t delete spot', error.message);
          if (!data || data.length === 0) return Alert.alert('Couldn’t delete spot', 'Only the person who added it or an admin can delete this spot.');
          emitJamsChanged();
          if (router.canGoBack()) router.back();
          else router.replace('/');
        },
      },
    ]);
  }
  // "The line is up" applies when the spot or any jam here is a slackline thing.
  const slackliney = s.disciplines.includes(SLACKLINE) || events.some((e) => e.disciplines.includes(SLACKLINE)) || lines.length > 0;

  async function checkIn() {
    const now = new Date();
    const hours = { '1h': 1, '2h': 2, '3h': 3 } as const;
    let ends = until === 'sunset' ? sunsetToday(s.lat, s.lng) : new Date(now.getTime() + hours[until] * 3600000);
    if (ends <= now) ends = new Date(now.getTime() + 3600000); // sunset already passed
    const { error } = await supabase.from('sessions').insert({
      user_id: profile!.id,
      spot_id: s.id,
      activity,
      ends_at: ends.toISOString(),
    });
    if (error) return Alert.alert('Couldn’t check in', error.message);
    setCheckingIn(false);
    load();
  }

  async function checkOut() {
    if (!mySession) return;
    await supabase.from('sessions').delete().eq('id', mySession.id);
    load();
  }

  async function saveReview() {
    const { error } = await supabase
      .from('spot_reviews')
      .upsert({ spot_id: s.id, user_id: profile!.id, rating, body: reviewText.trim() || null }, { onConflict: 'spot_id,user_id' });
    if (error) return Alert.alert('Couldn’t save review', error.message);
    load();
  }

  function moderate(kind: 'review' | 'session', targetId: string, userId: string, name?: string) {
    postMenu({ me: profile!.id, ownerId: userId, ownerName: name, targetType: kind, targetId, what: kind === 'review' ? 'review' : 'check-in', onBlocked: load });
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: s.name }} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 }}>
        <View style={{ gap: space.xs }}>
          {s.address ? <Text style={type.small}>{s.address}</Text> : null}
          {s.hours ? <Text style={type.small}>{s.hours}</Text> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs }}>
            {s.disciplines.map((d) => (
              <Chip key={d} label={d} />
            ))}
          </View>
        </View>
        <Button title="Directions" variant="secondary" onPress={() => Linking.openURL(`https://maps.apple.com/?daddr=${s.lat},${s.lng}`)} />

        {slackliney && <LineSection spot={s} lines={lines} userId={profile.id} onChange={load} />}

        {/* Out here now */}
        <Card>
          <Text style={type.h2}>Out here now</Text>
          {sessions.length === 0 ? (
            <Empty text="Nobody’s checked in. Be the first." />
          ) : (
            sessions.map((x) => (
              <Pressable
                key={x.id}
                accessibilityRole="button"
                onPress={() => router.push(`/profile/${x.user_id}`)}
                onLongPress={() => x.user_id !== profile.id && moderate('session', x.id, x.user_id, x.profile?.display_name)}
                style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.md }}
              >
                <Avatar url={x.profile?.avatar_url} name={x.profile?.display_name} size={36} />
                <Text style={[type.body, { flex: 1 }]}>
                  <Text style={{ fontWeight: '700' }}>{x.profile?.display_name ?? 'Someone'}</Text>
                  {x.activity ? ` · ${x.activity}` : ''} · until {formatTime(new Date(x.ends_at))}
                </Text>
              </Pressable>
            ))
          )}
          {mySession ? (
            <Button title="I’m heading out" variant="ghost" onPress={checkOut} />
          ) : checkingIn ? (
            <View style={{ gap: space.md }}>
              <Text style={type.label}>Doing</Text>
              <Segmented options={s.disciplines.map((d) => ({ label: d, value: d }))} value={activity ?? ''} onChange={(v) => setActivity(v)} />
              <Text style={type.label}>Until</Text>
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
              <Button title="I’m out here" onPress={checkIn} />
            </View>
          ) : (
            <Button title="I’m out here" onPress={() => setCheckingIn(true)} />
          )}
        </Card>

        {/* Jams */}
        <Card>
          <Text style={type.h2}>Camps here</Text>
          {events.length === 0 && <Empty text="No camps here yet." />}
          {events.map((e) => {
            const occ = nextOccurrence(e, s.lat, s.lng);
            return (
              <View key={e.id} style={{ gap: 2, paddingVertical: space.xs }}>
                <Pressable accessibilityRole="button" onPress={() => router.push(`/camp/${e.id}`)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <JamThumb jam={e} size={44} />
                  <Text style={[type.body, { flex: 1, fontWeight: '700', color: colors.coralDark }]}>{e.name} ›</Text>
                </Pressable>
                <Text style={type.small}>
                  {describeSchedule(e)}
                  {e.music && e.music !== 'none' ? ` · ${MUSIC_LABEL[e.music]}` : ''}
                </Text>
                {occ && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={[type.small, { color: occ.happeningNow ? colors.grass : colors.coralDark, fontWeight: '700' }]}>{formatWhen(occ)}</Text>
                    <Button title="Add to calendar" variant="ghost" onPress={() => addJamToCalendar(e, occ)} />
                  </View>
                )}
              </View>
            );
          })}
          <Button title="Start a camp here" variant="ghost" onPress={() => router.push({ pathname: '/camp/new', params: { spotId: s.id } })} />
        </Card>

        {/* Details */}
        <Card>
          <Text style={type.h2}>The spot</Text>
          {s.features ? <Text style={type.body}>{s.features}</Text> : null}
          <Text style={type.small}>
            {[s.surface, FIRE_LABEL[s.fire_allowed], LIGHT_LABEL[s.lighting], s.is_public ? null : 'Private — only you can see it']
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {s.notes ? <Text style={type.small}>{s.notes}</Text> : null}
        </Card>

        {/* Reviews */}
        <Card>
          <Text style={type.h2}>
            Reviews{avg != null ? ` · ${avg > 0 ? '+' : ''}${avg.toFixed(1)}` : ''}
          </Text>
          <Text style={type.small}>Rate from −5 (avoid) to +5 (epic).</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Button title="−" variant="ghost" onPress={() => setRating(Math.max(-5, rating - 1))} />
            <Text style={[type.title, { minWidth: 56, textAlign: 'center', color: rating < 0 ? colors.coralDark : rating > 0 ? colors.grass : colors.night }]}>
              {rating > 0 ? `+${rating}` : rating}
            </Text>
            <Button title="+" variant="ghost" onPress={() => setRating(Math.min(5, rating + 1))} />
          </View>
          <Field label="Your take" value={reviewText} onChangeText={setReviewText} multiline placeholder="Anchors, crowds, cops, vibes…" />
          <Button title="Save review" onPress={saveReview} />
          {reviews.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => router.push(`/profile/${r.user_id}`)}
              onLongPress={() => r.user_id !== profile.id && moderate('review', r.id, r.user_id, r.profile?.display_name)}
              style={{ paddingTop: space.sm, gap: 2 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Avatar url={r.profile?.avatar_url} name={r.profile?.display_name} size={28} />
                <Text style={[type.body, { fontWeight: '700' }]}>
                  {r.rating > 0 ? `+${r.rating}` : r.rating} · {r.profile?.display_name ?? 'Member'}
                </Text>
              </View>
              {r.body ? <Text style={type.body}>{r.body}</Text> : null}
            </Pressable>
          ))}
          {reviews.length > 0 && <Text style={type.small}>Long-press a review to report it or block its author.</Text>}
        </Card>

        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Button title="Share spot" variant="ghost" onPress={() => shareLink('spot', s.id, s.name)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="QR code" variant="ghost" onPress={() => showQr('spot', s.id, s.name)} />
          </View>
        </View>
        {s.created_by !== profile.id && <ReportLink label="Report this spot" onPress={() => reportContent(profile.id, 'spot', s.id, 'spot')} />}
        {(s.created_by === profile.id || profile.is_admin) && <Button title="Delete spot" variant="danger" onPress={confirmDelete} />}
      </ScrollView>
    </Screen>
  );
}
