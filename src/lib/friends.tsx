import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from './supabase';
import { PUBLIC_PROFILE_COLUMNS, type Friendship, type PublicProfile } from './types';
import { Button } from './ui';

export type FriendLists = {
  friends: PublicProfile[];
  /** Requests other people sent you, waiting for your answer. */
  incoming: PublicProfile[];
  /** Requests you sent that haven't been answered. */
  outgoing: PublicProfile[];
};

/** Everyone you're connected to, sorted into friends and pending requests. */
export async function fetchFriendLists(me: string): Promise<FriendLists> {
  const { data: rows, error } = await supabase.from('friendships').select('requester, addressee, status, created_at');
  if (error) throw error;
  const links = (rows ?? []) as Friendship[];
  const others = links.map((f) => (f.requester === me ? f.addressee : f.requester));
  const { data: people } = others.length
    ? await supabase.from('profiles').select(PUBLIC_PROFILE_COLUMNS).in('id', others)
    : { data: [] };
  const byId = new Map(((people ?? []) as PublicProfile[]).map((p) => [p.id, p]));
  const pick = (keep: (f: Friendship) => boolean) =>
    links
      .filter(keep)
      .map((f) => byId.get(f.requester === me ? f.addressee : f.requester))
      .filter((p): p is PublicProfile => !!p)
      .sort((a, b) => a.display_name.localeCompare(b.display_name));
  return {
    friends: pick((f) => f.status === 'accepted'),
    incoming: pick((f) => f.status === 'pending' && f.addressee === me),
    outgoing: pick((f) => f.status === 'pending' && f.requester === me),
  };
}

export type FriendState = 'none' | 'friends' | 'requested' | 'incoming';

async function friendshipWith(me: string, other: string): Promise<Friendship | null> {
  const { data } = await supabase
    .from('friendships')
    .select('requester, addressee, status, created_at')
    .or(`and(requester.eq.${me},addressee.eq.${other}),and(requester.eq.${other},addressee.eq.${me})`)
    .maybeSingle();
  return (data as Friendship | null) ?? null;
}

function stateOf(me: string, f: Friendship | null): FriendState {
  if (!f) return 'none';
  if (f.status === 'accepted') return 'friends';
  return f.requester === me ? 'requested' : 'incoming';
}

/** Send a request, or accept theirs if they already asked you. */
export async function addFriend(me: string, other: string) {
  const existing = await friendshipWith(me, other);
  if (existing?.status === 'pending' && existing.addressee === me) return acceptFriend(me, other);
  if (existing) return { error: null };
  return supabase.from('friendships').insert({ requester: me, addressee: other });
}

export async function acceptFriend(me: string, other: string) {
  return supabase.from('friendships').update({ status: 'accepted' }).eq('requester', other).eq('addressee', me);
}

/** Decline a request, cancel yours, or end a friendship. */
export async function removeFriend(me: string, other: string) {
  return supabase
    .from('friendships')
    .delete()
    .or(`and(requester.eq.${me},addressee.eq.${other}),and(requester.eq.${other},addressee.eq.${me})`);
}

/** Add friend / Requested / Accept / Friends ✓ button for a profile page. */
export function FriendButton({ me, other, name }: { me: string; other: string; name: string }) {
  const [state, setState] = useState<FriendState | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    friendshipWith(me, other)
      .then((f) => setState(stateOf(me, f)))
      .catch(() => setState('none'));
  }, [me, other]);
  useEffect(refresh, [refresh]);

  async function run(action: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true);
    const { error } = await action();
    setBusy(false);
    if (error) Alert.alert('Couldn’t update', error.message);
    refresh();
  }

  if (state === null) return null;
  if (state === 'friends') {
    return (
      <Button
        title="Friends ✓"
        variant="secondary"
        loading={busy}
        onPress={() =>
          Alert.alert(`Remove ${name} as a friend?`, 'They won’t see your friends-only check-ins anymore.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => run(() => removeFriend(me, other)) },
          ])
        }
      />
    );
  }
  if (state === 'incoming') {
    return (
      <>
        <Button title={`Accept ${name}’s friend request`} loading={busy} onPress={() => run(() => acceptFriend(me, other))} />
        <Button title="Decline" variant="ghost" onPress={() => run(() => removeFriend(me, other))} />
      </>
    );
  }
  if (state === 'requested') {
    return <Button title="Request sent · Cancel" variant="ghost" loading={busy} onPress={() => run(() => removeFriend(me, other))} />;
  }
  return <Button title="Add friend" loading={busy} onPress={() => run(() => addFriend(me, other))} />;
}
