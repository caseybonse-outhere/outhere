import { supabase } from './supabase';
import type { JamEvent, Review, Session, Spot } from './types';

export async function fetchSpots(): Promise<Spot[]> {
  const { data, error } = await supabase.from('spots').select('*').order('name');
  if (error) throw error;
  return (data ?? []) as Spot[];
}

export async function fetchActiveSessions(spotId?: string): Promise<Session[]> {
  let q = supabase
    .from('sessions')
    .select('*, profile:profiles(display_name)')
    .gt('ends_at', new Date().toISOString())
    .lte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: false });
  if (spotId) q = q.eq('spot_id', spotId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Session[];
}

export async function fetchEvents(spotId?: string): Promise<JamEvent[]> {
  let q = supabase.from('events').select('*, spot:spots(id, name, lat, lng, address)');
  if (spotId) q = q.eq('spot_id', spotId);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as JamEvent[]).filter((e) => e.spot);
}

export async function fetchReviews(spotId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('spot_reviews')
    .select('*, profile:profiles(display_name)')
    .eq('spot_id', spotId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Review[];
}

export async function report(reporterId: string, targetType: 'spot' | 'review' | 'event' | 'session' | 'profile', targetId: string) {
  return supabase.from('reports').insert({ reporter_id: reporterId, target_type: targetType, target_id: targetId });
}

export async function block(blockerId: string, blockedId: string) {
  return supabase.from('blocks').insert({ blocker_id: blockerId, blocked_id: blockedId });
}
