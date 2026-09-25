-- Out Here — initial schema
-- Paste into Supabase: Dashboard → SQL Editor → New query → Run.

-- ─── Helpers ──────────────────────────────────────────────────────────────

-- Great-circle distance in miles (no PostGIS needed at this scale).
create or replace function public.distance_miles(lat1 double precision, lng1 double precision,
                                                 lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 3958.8 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- ─── Tables ───────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  disciplines text[] not null default '{}',
  bio text,
  alerts_enabled boolean not null default true,
  alert_radius_miles integer not null default 10 check (alert_radius_miles between 1 and 100),
  home_lat double precision,   -- rounded to ~1 km by the app
  home_lng double precision,
  push_token text,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.invites (
  code text primary key,
  created_by uuid references public.profiles (id) on delete cascade,
  used_by uuid references public.profiles (id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.spots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  lat double precision not null,
  lng double precision not null,
  hours text,
  disciplines text[] not null default '{}',
  features text,
  surface text,
  fire_allowed text not null default 'unknown' check (fire_allowed in ('yes', 'no', 'permit', 'unknown')),
  lighting text not null default 'unknown' check (lighting in ('yes', 'no', 'unknown')),
  is_public boolean not null default true,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.spot_reviews (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references public.spots (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating integer not null check (rating between -5 and 5),
  body text,
  created_at timestamptz not null default now(),
  unique (spot_id, user_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  spot_id uuid not null references public.spots (id) on delete cascade,
  description text,
  disciplines text[] not null default '{}',
  recurrence text not null default 'weekly' check (recurrence in ('weekly', 'biweekly', 'once')),
  day_of_week integer not null check (day_of_week between 0 and 6),  -- 0 = Sunday
  start_type text not null default 'fixed' check (start_type in ('fixed', 'sunset')),
  start_time time,                         -- used when start_type = 'fixed'
  sunset_offset_min integer not null default 0,
  duration_min integer not null default 180,
  start_date date,                         -- anchor for biweekly, the date for once
  organizer text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (start_type = 'sunset' or start_time is not null)
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  spot_id uuid not null references public.spots (id) on delete cascade,
  activity text,
  note text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at <= starts_at + interval '12 hours')
);
create index sessions_active_idx on public.sessions (spot_id, ends_at);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('spot', 'review', 'event', 'session', 'profile')),
  target_id uuid not null,
  reason text,
  created_at timestamptz not null default now()
);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

-- ─── Membership ───────────────────────────────────────────────────────────

-- A member is a signed-in user who has redeemed an invite (and so has a profile).
create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

create or replace function public.is_blocked(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where blocker_id = auth.uid() and blocked_id = other);
$$;

-- Redeem an invite code: creates the caller's profile and gives them 3 codes to share.
create or replace function public.redeem_invite(p_code text, p_display_name text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_invite public.invites;
  i integer;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    return;  -- already a member
  end if;

  select * into v_invite from public.invites
   where upper(code) = upper(trim(p_code)) and used_by is null
   for update;
  if not found then
    raise exception 'That invite code is invalid or already used';
  end if;

  insert into public.profiles (id, display_name, invited_by)
  values (auth.uid(), trim(p_display_name), v_invite.created_by);

  update public.invites set used_by = auth.uid(), used_at = now() where code = v_invite.code;

  for i in 1..3 loop
    insert into public.invites (code, created_by)
    values (upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)), auth.uid());
  end loop;
end;
$$;

-- App Store requirement: members can delete their own account.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

-- Push tokens of members whose alert radius covers a spot (used by the notify-nearby function).
create or replace function public.members_near(p_lat double precision, p_lng double precision, p_exclude uuid)
returns table (id uuid, push_token text)
language sql stable security definer set search_path = public as $$
  select p.id, p.push_token
    from public.profiles p
   where p.alerts_enabled
     and p.push_token is not null
     and p.home_lat is not null
     and p.id is distinct from p_exclude
     and public.distance_miles(p.home_lat, p.home_lng, p_lat, p_lng) <= p.alert_radius_miles;
$$;
revoke execute on function public.members_near from public, anon, authenticated;

-- ─── Row-level security ───────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.spots enable row level security;
alter table public.spot_reviews enable row level security;
alter table public.events enable row level security;
alter table public.sessions enable row level security;
alter table public.reports enable row level security;
alter table public.blocks enable row level security;

-- Profiles: members can see each other (the app never selects location or push columns for others).
create policy "members read profiles" on public.profiles for select using (public.is_member() or id = auth.uid());
create policy "update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Hide precise-ish fields from other members at the column level.
revoke select on public.profiles from authenticated;
grant select (id, display_name, disciplines, bio, created_at, invited_by) on public.profiles to authenticated;
create or replace function public.my_profile()
returns setof public.profiles language sql stable security definer set search_path = public as $$
  select * from public.profiles where id = auth.uid();
$$;

-- Invites: see the codes you own.
create policy "read own invites" on public.invites for select using (created_by = auth.uid());

-- Spots: public spots for members, private spots only for their creator.
create policy "members read spots" on public.spots for select
  using (public.is_member() and (is_public or created_by = auth.uid()));
create policy "members add spots" on public.spots for insert
  with check (public.is_member() and created_by = auth.uid());
create policy "edit own spots" on public.spots for update using (created_by = auth.uid());
create policy "delete own spots" on public.spots for delete using (created_by = auth.uid());

-- Reviews
create policy "members read reviews" on public.spot_reviews for select
  using (public.is_member() and not public.is_blocked(user_id));
create policy "write own review" on public.spot_reviews for insert
  with check (public.is_member() and user_id = auth.uid());
create policy "edit own review" on public.spot_reviews for update using (user_id = auth.uid());
create policy "delete own review" on public.spot_reviews for delete using (user_id = auth.uid());

-- Events (jams)
create policy "members read events" on public.events for select using (public.is_member());
create policy "members add events" on public.events for insert
  with check (public.is_member() and created_by = auth.uid());
create policy "edit own events" on public.events for update using (created_by = auth.uid());
create policy "delete own events" on public.events for delete using (created_by = auth.uid());

-- Sessions ("I'm here now")
create policy "members read sessions" on public.sessions for select
  using (public.is_member() and not public.is_blocked(user_id));
create policy "start own session" on public.sessions for insert
  with check (public.is_member() and user_id = auth.uid());
create policy "edit own session" on public.sessions for update using (user_id = auth.uid());
create policy "end own session" on public.sessions for delete using (user_id = auth.uid());

-- Reports and blocks
create policy "file reports" on public.reports for insert with check (public.is_member() and reporter_id = auth.uid());
create policy "read own blocks" on public.blocks for select using (blocker_id = auth.uid());
create policy "add own blocks" on public.blocks for insert with check (blocker_id = auth.uid());
create policy "remove own blocks" on public.blocks for delete using (blocker_id = auth.uid());
