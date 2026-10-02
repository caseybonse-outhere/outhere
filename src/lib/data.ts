import { supabase } from './supabase';
import type { JamEvent, JamMember, Line, Photo, Review, Session, Spot, Thread } from './types';

export async function fetchSpots(): Promise<Spot[]> {
  const { data, error } = await supabase.from('spots').select('*').order('name');
  if (error) throw error;
  return (data ?? []) as Spot[];
}

export async function fetchActiveSessions(spotId?: string): Promise<Session[]> {
  let q = supabase
    .from('sessions')
    .select('*, profile:profiles(display_name, avatar_url)')
    .gt('ends_at', new Date().toISOString())
    .lte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: false });
  if (spotId) q = q.eq('spot_id', spotId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Session[];
}

export async function fetchEvents(spotId?: string): Promise<JamEvent[]> {
  let q = supabase.from('events').select('*, spot:spots(id, name, lat, lng, address, disciplines), jam_members(count)');
  if (spotId) q = q.eq('spot_id', spotId);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as JamEvent[]).filter((e) => e.spot);
}

export async function fetchReviews(spotId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('spot_reviews')
    .select('*, profile:profiles(display_name, avatar_url)')
    .eq('spot_id', spotId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Review[];
}

export async function report(reporterId: string, targetType: 'spot' | 'review' | 'event' | 'session' | 'profile' | 'photo' | 'message', targetId: string) {
  return supabase.from('reports').insert({ reporter_id: reporterId, target_type: targetType, target_id: targetId });
}

export async function block(blockerId: string, blockedId: string) {
  return supabase.from('blocks').insert({ blocker_id: blockerId, blocked_id: blockedId });
}

export async function fetchActiveLines(spotId?: string): Promise<Line[]> {
  let q = supabase
    .from('lines')
    .select('*, profile:profiles(display_name, avatar_url)')
    .gt('up_until', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (spotId) q = q.eq('spot_id', spotId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Line[];
}

export async function fetchThreads(): Promise<Thread[]> {
  const { data, error } = await supabase.rpc('my_threads');
  if (error) throw error;
  return (data ?? []) as Thread[];
}

export async function fetchJamMembers(eventId: string): Promise<JamMember[]> {
  const { data, error } = await supabase
    .from('jam_members')
    .select('*, profile:profiles(display_name, avatar_url)')
    .eq('event_id', eventId)
    .order('role', { ascending: false })
    .order('joined_at');
  if (error) throw error;
  return (data ?? []) as JamMember[];
}

/** Event ids of the jams the current member belongs to. */
export async function fetchMyJamIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase.from('jam_members').select('event_id').eq('user_id', userId);
  return new Set((data ?? []).map((r: { event_id: string }) => r.event_id));
}

export async function fetchPhotos(userId: string, limit?: number): Promise<{ photos: Photo[]; total: number }> {
  let q = supabase.from('photos').select('*', { count: 'exact' }).eq('user_id', userId).order('created_at', { ascending: false });
  if (limit) q = q.limit(limit);
  const { data, error, count } = await q;
  if (error) throw error;
  return { photos: (data ?? []) as Photo[], total: count ?? (data ?? []).length };
}
