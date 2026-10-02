import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../../lib/auth';
import { Avatar } from '../../lib/avatar';
import { block, report } from '../../lib/data';
import { supabase } from '../../lib/supabase';
import { space, type } from '../../lib/theme';
import { PUBLIC_PROFILE_COLUMNS, type PublicProfile } from '../../lib/types';
import { Button, Card, Chip, Empty, Screen } from '../../lib/ui';

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile: me } = useAuth();
  const [person, setPerson] = useState<PublicProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase
      .from('profiles')
      .select(PUBLIC_PROFILE_COLUMNS)
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        setPerson(data as PublicProfile | null);
        setLoaded(true);
      });
  }, [id]);

  if (!person) {
    return (
      <Screen style={{ padding: space.xl }}>
        <Empty text={loaded ? 'This member isn’t around anymore.' : 'Loading…'} />
      </Screen>
    );
  }

  const isMe = me?.id === person.id;
  const since = new Date(person.created_at).toLocaleDateString([], { month: 'long', year: 'numeric' });

  return (
    <Screen>
      <Stack.Screen options={{ title: '' }} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 }}>
        <View style={{ alignItems: 'center', gap: space.sm }}>
          <Avatar url={person.avatar_url} name={person.display_name} size={120} />
          <Text style={type.title}>{person.display_name}</Text>
          <Text style={type.small}>Out here since {since}</Text>
        </View>

        {person.bio ? (
          <Card>
            <Text style={type.body}>{person.bio}</Text>
          </Card>
        ) : null}

        {person.disciplines.length > 0 && (
          <Card>
            <Text style={type.label}>What they do</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
              {person.disciplines.map((d) => (
                <Chip key={d} label={d} />
              ))}
            </View>
          </Card>
        )}

        {(person.interests ?? []).length > 0 && (
          <Card>
            <Text style={type.label}>Into</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
              {person.interests.map((d) => (
                <Chip key={d} label={d} />
              ))}
            </View>
          </Card>
        )}

        {!isMe && me && (
          <View style={{ gap: space.sm }}>
            <Button
              title="Report"
              variant="ghost"
              onPress={async () => {
                await report(me.id, 'profile', person.id);
                Alert.alert('Thanks — we’ll take a look.');
              }}
            />
            <Button
              title="Block"
              variant="ghost"
              onPress={() =>
                Alert.alert(`Block ${person.display_name}?`, 'You won’t see their check-ins or reviews.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Block',
                    style: 'destructive',
                    onPress: async () => {
                      await block(me.id, person.id);
                      Alert.alert('Blocked.');
                    },
                  },
                ])
              }
            />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
