export const DISCIPLINES = [
  'Flow Arts',
  'Slackline',
  'Acro',
  'Parkour',
  'Rings & Gymnastics',
  'Dance',
  'Juggling',
  'Yoga',
  'Hiking',
] as const;
export type Discipline = (typeof DISCIPLINES)[number];

/** Things people are into beyond what they practice. */
export const INTERESTS = [
  'Teaching',
  'Learning',
  'Fire spinning',
  'LED / glow',
  'Prop making',
  'Photo & video',
  'DJing',
  'Live music',
  'Festivals',
  'Workshops',
  'Meditation',
  'Beach cleanups',
] as const;

export type Music = 'none' | 'speaker' | 'dj' | 'live';
export const MUSIC_LABEL: Record<Music, string> = {
  none: 'No music',
  speaker: 'Speaker',
  dj: 'DJ',
  live: 'Live music',
};

export type Profile = {
  id: string;
  display_name: string;
  disciplines: string[];
  bio: string | null;
  interests: string[];
  avatar_url: string | null;
  alerts_enabled: boolean;
  alert_radius_miles: number;
  home_lat: number | null;
  home_lng: number | null;
  push_token: string | null;
  created_at: string;
  terms_accepted_at: string | null;
  is_admin: boolean;
  banned_at: string | null;
};

export type Spot = {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  hours: string | null;
  disciplines: string[];
  features: string | null;
  surface: string | null;
  fire_allowed: 'yes' | 'no' | 'permit' | 'unknown';
  lighting: 'yes' | 'no' | 'unknown';
  is_public: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type Recurrence = 'weekly' | 'biweekly' | 'once';
export type StartType = 'fixed' | 'sunset';

export type JamEvent = {
  id: string;
  name: string;
  spot_id: string;
  description: string | null;
  disciplines: string[];
  recurrence: Recurrence;
  day_of_week: number; // 0 = Sunday
  start_type: StartType;
  start_time: string | null; // "16:00:00" when fixed
  sunset_offset_min: number; // minutes relative to sunset when start_type = sunset
  duration_min: number;
  start_date: string | null; // anchor date for biweekly / date for once
  organizer: string | null;
  music: Music | null;
  cover_url: string | null;
  /** Exact meeting point inside the spot, set by the organizer. */
  meet_lat: number | null;
  meet_lng: number | null;
  meet_note: string | null;
  created_by: string | null;
  created_at: string;
  spot?: Pick<Spot, 'id' | 'name' | 'lat' | 'lng' | 'address' | 'disciplines'>;
  /** Member count, embedded by fetchEvents. */
  jam_members?: { count: number }[];
};

export type Session = {
  id: string;
  user_id: string;
  spot_id: string;
  activity: string | null;
  note: string | null;
  starts_at: string;
  ends_at: string;
  profile?: Pick<Profile, 'display_name' | 'avatar_url'>;
};

export type Review = {
  id: string;
  spot_id: string;
  user_id: string;
  rating: number; // -5 .. +5
  body: string | null;
  created_at: string;
  profile?: Pick<Profile, 'display_name' | 'avatar_url'>;
};


/** What any member can see about another member. */
export type PublicProfile = Pick<Profile, 'id' | 'display_name' | 'disciplines' | 'interests' | 'bio' | 'avatar_url' | 'created_at'>;
export const PUBLIC_PROFILE_COLUMNS = 'id, display_name, disciplines, interests, bio, avatar_url, created_at';

export type LineType = 'slackline' | 'trickline' | 'longline' | 'highline' | 'waterline' | 'rodeo';
export const LINE_TYPE_LABEL: Record<LineType, string> = {
  slackline: 'Slackline',
  trickline: 'Trickline',
  longline: 'Longline',
  highline: 'Highline',
  waterline: 'Waterline',
  rodeo: 'Rodeo line',
};

export type Line = {
  id: string;
  spot_id: string;
  user_id: string;
  line_type: LineType;
  length_ft: number | null;
  note: string | null;
  up_until: string;
  /** Where the line is rigged, if the poster dropped a pin. */
  pin_lat: number | null;
  pin_lng: number | null;
  created_at: string;
  profile?: Pick<Profile, 'display_name' | 'avatar_url'>;
};

/** "I'm going" for one camp session (occurs_on = local date the session starts). */
export type Rsvp = {
  event_id: string;
  user_id: string;
  occurs_on: string;
  profile?: Pick<Profile, 'display_name' | 'avatar_url'>;
};

export type JamMember = {
  event_id: string;
  user_id: string;
  role: 'member' | 'organizer';
  joined_at: string;
  profile?: Pick<Profile, 'display_name' | 'avatar_url'>;
};

/** Slackline is the discipline that unlocks "the line is up". */
export const SLACKLINE = 'Slackline';

export type ReportTarget = 'spot' | 'review' | 'event' | 'session' | 'profile' | 'line';

/** One open report, as the moderation screen sees it. */
export type OpenReport = {
  id: string;
  target_type: ReportTarget;
  target_id: string;
  reason: string | null;
  created_at: string;
  reporter_name: string | null;
  owner_id: string | null;
  owner_name: string | null;
  owner_banned: boolean | null;
  preview: string;
};
