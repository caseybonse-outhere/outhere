import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { Avatar } from '../../lib/avatar';
import { fetchThreads } from '../../lib/data';
import { onIncomingMessage, timeAgo } from '../../lib/messages';
import { colors, radius, space, type } from '../../lib/theme';
import type { Thread } from '../../lib/types';
import { Empty, Screen } from '../../lib/ui';

export default function Inbox() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setThreads(await fetchThreads());
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

  // New message while the inbox is open → refresh the list.
  useEffect(() => onIncomingMessage(() => load()), [load]);

  return (
    <Screen>
      <FlatList
        data={threads}
        keyExtractor={(t) => t.other_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        contentContainerStyle={{ padding: space.lg, gap: space.sm, flexGrow: 1 }}
        ListEmptyComponent={
          <Empty text="No messages yet. Open someone’s profile — from a jam, a check-in or a review — and tap Message." />
        }
        renderItem={({ item: t }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Conversation with ${t.display_name}${t.unread ? `, ${t.unread} unread` : ''}`}
            onPress={() => router.push(`/messages/${t.other_id}`)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
              padding: space.md,
              borderRadius: radius.lg,
              backgroundColor: pressed ? colors.sand2 : colors.white,
              borderWidth: 1,
              borderColor: colors.line,
            })}
          >
            <Avatar url={t.avatar_url} name={t.display_name} size={48} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                <Text style={[type.body, { fontWeight: '800', flexShrink: 1 }]} numberOfLines={1}>
                  {t.display_name}
                </Text>
                <Text style={type.small}>{timeAgo(t.last_at)}</Text>
              </View>
              <Text style={[type.small, t.unread > 0 && { color: colors.night, fontWeight: '700' }]} numberOfLines={1}>
                {t.last_from_me ? 'You: ' : ''}
                {t.last_body}
              </Text>
            </View>
            {t.unread > 0 && (
              <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.coralDark, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
                <Text style={{ color: colors.white, fontWeight: '800', fontSize: 12 }}>{t.unread}</Text>
              </View>
            )}
          </Pressable>
        )}
      />
    </Screen>
  );
}
