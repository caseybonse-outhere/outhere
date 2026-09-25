export const DISCIPLINES = [
  'Flow Arts',
  'Slackline',
  'Acro',
  'Parkour',
  'Rings & Gymnastics',
  'Dance',
  'Juggling',
] as const;
export type Discipline = (typeof DISCIPLINES)[number];

export type Profile = {
  id: string;
  display_name: string;
  disciplines: string[];
  bio: string | null;
  alerts_enabled: boolean;
  alert_radius_miles: number;
  home_lat: number | null;
  home_lng: number | null;
  push_token: string | null;
  created_at: string;
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
  created_by: string | null;
  created_at: string;
  spot?: Pick<Spot, 'id' | 'name' | 'lat' | 'lng' | 'address'>;
};

export type Session = {
  id: string;
  user_id: string;
  spot_id: string;
  activity: string | null;
  note: string | null;
  starts_at: string;
  ends_at: string;
  profile?: Pick<Profile, 'display_name'>;
};

export type Review = {
  id: string;
  spot_id: string;
  user_id: string;
  rating: number; // -5 .. +5
  body: string | null;
  created_at: string;
  profile?: Pick<Profile, 'display_name'>;
};

export type Invite = {
  code: string;
  created_by: string | null;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
};
