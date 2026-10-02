import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { Avatar } from '../../lib/avatar';
import { onIncomingMessage, refreshUnread } from '../../lib/messages';
import { formatTime } from '../../lib/schedule';
import { supabase } from '../../lib/supabase';
import { colors, radius, space, type } from '../../lib/theme';
import { PUBLIC_PROFILE_COLUMNS, type Message, type PublicProfile } from '../../lib/types';
import { Empty, Screen } from '../../lib/ui';

export default function Conversation() {
  const { id: otherId } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [other, setOther] = useState<PublicProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]); // newest first (list is inverted)
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const me = profile?.id;

  const markRead = useCallback(async () => {
    if (!me) return;
    await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('recipient_id', me).eq('sender_id', otherId).is('read_at', null);
    refreshUnread();
  }, [me, otherId]);

  const load = useCallback(async () => {
    if (!me) return;
    const [{ data: p }, { data: m }] = await Promise.all([
      supabase.from('profiles').select(PUBLIC_PROFILE_COLUMNS).eq('id', otherId).maybeSingle(),
      supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${me},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${me})`)
        .order('created_at', { ascending: false })
        .limit(200),
    ]);
    setOther(p as PublicProfile | null);
    setMessages((m ?? []) as Message[]);
    markRead();
  }, [me, otherId, markRead]);

  useEffect(() => {
    load();
  }, [load]);

  // Live: messages from this person appear instantly.
  useEffect(
    () =>
      onIncomingMessage((m) => {
        if (m.sender_id !== otherId) return;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [m, ...prev]));
        markRead();
      }),
    [otherId, markRead],
  );

  async function send() {
    const body = draft.trim();
    if (!body || !me) return;
    setSending(true);
    const { data, error } = await supabase.from('messages').insert({ sender_id: me, recipient_id: otherId, body }).select('*').single();
    setSending(false);
    if (error) {
      const blocked = error.message.toLowerCase().includes('row-level security');
      return Alert.alert('Message not sent', blocked ? 'You can’t message this person.' : error.message);
    }
    setDraft('');
    setMessages((prev) => [data as Message, ...prev]);
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View ${other?.display_name ?? 'their'} profile`}
              onPress={() => router.push(`/profile/${otherId}`)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
            >
              <Avatar url={other?.avatar_url} name={other?.display_name} size={30} />
              <Text style={[type.body, { fontWeight: '800' }]} numberOfLines={1}>
                {other?.display_name ?? ''}
              </Text>
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}>
        <FlatList
          inverted
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: space.lg, gap: space.sm, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={{ transform: [{ scaleY: -1 }] }}>
              <Empty text={other ? `Say hi to ${other.display_name}.` : ''} />
            </View>
          }
          renderItem={({ item: m }) => {
            const mine = m.sender_id === me;
            return (
              <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', gap: 2 }}>
                <View
                  style={{
                    backgroundColor: mine ? colors.dusk : colors.white,
                    borderWidth: mine ? 0 : 1,
                    borderColor: colors.line,
                    borderRadius: radius.lg,
                    borderBottomRightRadius: mine ? 4 : radius.lg,
                    borderBottomLeftRadius: mine ? radius.lg : 4,
                    paddingHorizontal: space.md,
                    paddingVertical: space.sm,
                  }}
                >
                  <Text style={{ fontSize: 16, color: mine ? colors.white : colors.night }}>{m.body}</Text>
                </View>
                <Text style={[type.small, { fontSize: 12, alignSelf: mine ? 'flex-end' : 'flex-start' }]}>
                  {formatTime(new Date(m.created_at))}
                  {mine && m.read_at ? ' · Seen' : ''}
                </Text>
              </View>
            );
          }}
        />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: space.sm,
            paddingHorizontal: space.md,
            paddingTop: space.sm,
            paddingBottom: Math.max(insets.bottom, space.sm),
            borderTopWidth: 1,
            borderTopColor: colors.line,
            backgroundColor: colors.sand,
          }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={2000}
            accessibilityLabel="Message"
            style={{
              flex: 1,
              minHeight: 44,
              maxHeight: 120,
              backgroundColor: colors.white,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: colors.line,
              paddingHorizontal: space.lg,
              paddingTop: 12,
              paddingBottom: 12,
              fontSize: 16,
              color: colors.night,
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            onPress={send}
            disabled={!draft.trim() || sending}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.coralDark,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: !draft.trim() || sending ? 0.4 : 1,
            }}
          >
            <Ionicons name="arrow-up" size={22} color={colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
