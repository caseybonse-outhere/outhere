import { supabase } from './supabase';
import { localDate } from './schedule';
import type { JamEvent, JamMember, Line, OpenReport, ReportTarget, Review, Rsvp, Session, Spot, Visibility } from './types';

export async function fetchSpots(): Promise<Spot[]> {
  const { data, error } = await supabase.from('spots').select('*').order('name');
  if (error) throw error;
  return (data ?? []) as Spot[];
}

type SessionRow = Omit<Session, 'profile'> & { display_name: string | null; avatar_url: string | null };

/** Who's out now, through active_sessions(): friends-only check-ins you may not see are left out, anonymous ones have no name. */
export async function fetchActiveSessions(spotId?: string): Promise<Session[]> {
  const { data, error } = await supabase.rpc('active_sessions', spotId ? { p_spot: spotId } : {});
  if (error) throw error;
  return ((data ?? []) as SessionRow[]).map(({ display_name, avatar_url, ...s }) => ({
    ...s,
    details: s.details ?? [],
    profile: display_name ? { display_name, avatar_url } : undefined,
  }));
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

type RsvpRow = Omit<Rsvp, 'profile'> & { display_name: string | null; avatar_url: string | null };

/** Everyone going to upcoming camp sessions (yesterday through the next two weeks), with the same visibility rules as check-ins. */
export async function fetchUpcomingRsvps(eventId?: string): Promise<Rsvp[]> {
  const now = new Date();
  const from = localDate(new Date(now.getTime() - 86400000));
  const to = localDate(new Date(now.getTime() + 15 * 86400000));
  const { data, error } = await supabase.rpc('upcoming_rsvps', { p_from: from, p_to: to, ...(eventId ? { p_event: eventId } : {}) });
  if (error) throw error;
  return ((data ?? []) as RsvpRow[]).map(({ display_name, avatar_url, ...r }) => ({
    ...r,
    profile: display_name ? { display_name, avatar_url } : undefined,
  }));
}

export async function setGoing(eventId: string, userId: string, occursOn: string, going: boolean, visibility: Visibility = 'everyone') {
  return going
    ? supabase.from('camp_rsvps').insert({ event_id: eventId, user_id: userId, occurs_on: occursOn, visibility })
    : supabase.from('camp_rsvps').delete().eq('event_id', eventId).eq('user_id', userId).eq('occurs_on', occursOn);
}
