import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { Avatar } from '../lib/avatar';
import { acceptFriend, addFriend, fetchFriendLists, removeFriend, type FriendLists } from '../lib/friends';
import { supabase } from '../lib/supabase';
import { colors, space, type } from '../lib/theme';
import { PUBLIC_PROFILE_COLUMNS, type PublicProfile } from '../lib/types';
import { Button, Card, Empty, Field, Screen } from '../lib/ui';

/** Find members, answer friend requests, and see your friends. */
export default function FriendsScreen() {
  const { profile } = useAuth();
  const [lists, setLists] = useState<FriendLists>({ friends: [], incoming: [], outgoing: [] });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicProfile[]>([]);

  const load = useCallback(() => {
    if (profile) fetchFriendLists(profile.id).then(setLists).catch(() => {});
  }, [profile]);
  useFocusEffect(load);

  // Search members by name (2+ letters).
  useEffect(() => {
    const q = query.trim();
    if (!profile || q.length < 2) return; // results only show for 2+ letters
    const t = setTimeout(() => {
      supabase
        .from('profiles')
        .select(PUBLIC_PROFILE_COLUMNS)
        .ilike('display_name', `%${q.replace(/[%_]/g, '')}%`)
        .neq('id', profile.id)
        .order('display_name')
        .limit(20)
        .then(({ data }) => setResults((data ?? []) as PublicProfile[]));
    }, 300);
    return () => clearTimeout(t);
  }, [query, profile]);

  if (!profile) return null;
  const me = profile.id;
  const known = new Set([...lists.friends, ...lists.incoming, ...lists.outgoing].map((p) => p.id));

  async function act(action: Promise<{ error: { message: string } | null }> | PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await action;
    if (error) Alert.alert('Couldn’t update', error.message);
    load();
  }

  const Person = ({ p, children }: { p: PublicProfile; children?: React.ReactNode }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52 }}>
      <Pressable accessibilityRole="button" onPress={() => router.push(`/profile/${p.id}`)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Avatar url={p.avatar_url} name={p.display_name} size={40} />
        <Text style={[type.body, { fontWeight: '700', flexShrink: 1 }]} numberOfLines={1}>
          {p.display_name}
        </Text>
      </Pressable>
      {children}
    </View>
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 }} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={type.small}>
            Friends can see check-ins and “I’m going” you share with Friends only. Friendship is two-way: they have to accept.
          </Text>
          <Field label="Find people" placeholder="Search by name" value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} />
          {query.trim().length >= 2 &&
            (results.length === 0 ? (
              <Empty text="No members with that name." />
            ) : (
              results.map((p) => (
                <Person key={p.id} p={p}>
                  {!known.has(p.id) && (
                    <Pressable accessibilityRole="button" onPress={() => act(addFriend(me, p.id))} style={{ minHeight: 44, justifyContent: 'center' }}>
                      <Text style={{ color: colors.coralDark, fontWeight: '800' }}>Add</Text>
                    </Pressable>
                  )}
                </Person>
              ))
            ))}
        </Card>

        {lists.incoming.length > 0 && (
          <Card>
            <Text style={type.h2}>Friend requests</Text>
            {lists.incoming.map((p) => (
              <View key={p.id} style={{ gap: space.sm }}>
                <Person p={p} />
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button title="Accept" onPress={() => act(acceptFriend(me, p.id))} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button title="Decline" variant="ghost" onPress={() => act(removeFriend(me, p.id))} />
                  </View>
                </View>
              </View>
            ))}
          </Card>
        )}

        <Card>
          <Text style={type.h2}>Friends{lists.friends.length ? ` · ${lists.friends.length}` : ''}</Text>
          {lists.friends.length === 0 ? (
            <Empty text="No friends yet. Search above, or tap Add friend on someone’s profile." />
          ) : (
            lists.friends.map((p) => <Person key={p.id} p={p} />)
          )}
        </Card>

        {lists.outgoing.length > 0 && (
          <Card>
            <Text style={type.h2}>Waiting for them</Text>
            {lists.outgoing.map((p) => (
              <Person key={p.id} p={p}>
                <Pressable accessibilityRole="button" onPress={() => act(removeFriend(me, p.id))} style={{ minHeight: 44, justifyContent: 'center' }}>
                  <Text style={{ color: colors.muted, fontWeight: '700' }}>Cancel</Text>
                </Pressable>
              </Person>
            ))}
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}
