import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from './supabase';
import type { Message } from './types';

/**
 * Tiny pub/sub so any screen can react to new messages for the current member
 * through a single realtime subscription (see useMessageStream).
 */
type Listener = (m: Message) => void;
const listeners = new Set<Listener>();
const unreadListeners = new Set<() => void>();

export function onIncomingMessage(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Ask the unread badge to recount (e.g. after a thread is marked read). */
export function refreshUnread() {
  unreadListeners.forEach((fn) => fn());
}

/** Opens one realtime channel for messages sent to this member. Mount once (tabs layout). */
export function useMessageStream(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`inbox:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${userId}` },
        (payload) => {
          const m = payload.new as Message;
          listeners.forEach((fn) => fn(m));
          refreshUnread();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}

/** Number of unread messages for the tab badge. */
export function useUnreadCount(userId: string | undefined): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const recount = async () => {
      const { count: n } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .is('read_at', null);
      setCount(n ?? 0);
    };
    recount();
    unreadListeners.add(recount);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && recount());
    return () => {
      unreadListeners.delete(recount);
      sub.remove();
    };
  }, [userId]);

  return count;
}

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
