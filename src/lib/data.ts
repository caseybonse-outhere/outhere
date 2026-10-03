import { supabase } from './supabase';
import type { JamEvent, JamMember, Line, OpenReport, ReportTarget, Review, Session, Spot } from './types';

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

const EVENT_SPOT = 'spot:spots(id, name, lat, lng, address, disciplines)';

export async function fetchEvents(spotId?: string): Promise<JamEvent[]> {
  const query = (withCounts: boolean) => {
    const columns: string = withCounts ? `*, ${EVENT_SPOT}, jam_members(count)` : `*, ${EVENT_SPOT}`;
    let q = supabase.from('events').select(columns);
    if (spotId) q = q.eq('spot_id', spotId);
    return q;
  };
  let { data, error } = await query(true);
  // If member counts aren't available (e.g. a database update is missing), still show the jams.
  if (error) ({ data, error } = await query(false));
  if (error) throw error;
  return ((data ?? []) as unknown as JamEvent[]).filter((e) => e.spot);
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

export async function report(reporterId: string, targetType: ReportTarget, targetId: string, reason?: string) {
  return supabase.from('reports').insert({ reporter_id: reporterId, target_type: targetType, target_id: targetId, reason: reason ?? null });
}

/** Admins only: everything people have reported that hasn't been handled yet. */
export async function fetchOpenReports(): Promise<OpenReport[]> {
  const { data, error } = await supabase.rpc('admin_open_reports');
  if (error) throw error;
  return (data ?? []) as OpenReport[];
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
