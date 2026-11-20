-- Out Here Now — friends and who can see you
-- Paste into Supabase: SQL Editor → New query → Run. Safe to run more than once. Run after 0011.
--
-- • Friends: send a request, the other person accepts. Always two-way. Blocking removes the friendship.
-- • Who can see a check-in or an "I'm going":
--     everyone   — any member sees your name (as before)
--     friends    — only your friends see it; everyone else doesn't see it at all
--     anonymous  — everyone sees "someone" is there, nobody sees who (except you)
--   Members pick a default on the Me tab and can change it for each check-in.
-- • Check-ins and RSVPs are read through active_sessions() and upcoming_rsvps(), which apply these rules.
--   The tables themselves only ever return your own rows and rows you're allowed to see by name.
-- • A person who blocked you no longer sees your check-ins or RSVPs, and you don't see theirs.

-- ─── Friends ──────────────────────────────────────────────────────────────
create table if not exists public.friendships (
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
-- One friendship per pair, whichever way round it was asked.
create unique index if not exists friendships_pair_idx
  on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index if not exists friendships_addressee_idx on public.friendships (addressee);
alter table public.friendships enable row level security;

-- Has `other` blocked the current member?
create or replace function public.blocked_me(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where blocker_id = other and blocked_id = auth.uid());
$$;

create or replace function public.is_friend(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships
     where status = 'accepted'
       and ((requester = auth.uid() and addressee = other) or (requester = other and addressee = auth.uid()))
  );
$$;

drop policy if exists "see own friendships" on public.friendships;
drop policy if exists "send friend requests" on public.friendships;
drop policy if exists "accept friend requests" on public.friendships;
drop policy if exists "remove friendships" on public.friendships;
create policy "see own friendships" on public.friendships for select
  using (auth.uid() in (requester, addressee));
create policy "send friend requests" on public.friendships for insert
  with check (public.is_member() and requester = auth.uid() and status = 'pending'
              and not public.is_blocked(addressee) and not public.blocked_me(addressee));
create policy "accept friend requests" on public.friendships for update
  using (addressee = auth.uid()) with check (addressee = auth.uid() and status = 'accepted');
create policy "remove friendships" on public.friendships for delete
  using (auth.uid() in (requester, addressee));
revoke update on public.friendships from authenticated;
grant update (status) on public.friendships to authenticated;

-- Blocking someone ends any friendship or request between you.
create or replace function public.unfriend_on_block()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.friendships
   where (requester = new.blocker_id and addressee = new.blocked_id)
      or (requester = new.blocked_id and addressee = new.blocker_id);
  return new;
end;
$$;
drop trigger if exists unfriend_on_block on public.blocks;
create trigger unfriend_on_block after insert on public.blocks
  for each row execute function public.unfriend_on_block();

-- ─── Visibility settings ──────────────────────────────────────────────────
alter table public.profiles add column if not exists checkin_visibility text not null default 'everyone';
alter table public.profiles drop constraint if exists profiles_checkin_visibility_check;
alter table public.profiles add constraint profiles_checkin_visibility_check
  check (checkin_visibility in ('everyone', 'friends', 'anonymous'));
grant update (checkin_visibility) on public.profiles to authenticated;   -- only you read it, through my_profile()

alter table public.sessions add column if not exists visibility text not null default 'everyone';
alter table public.sessions drop constraint if exists sessions_visibility_check;
alter table public.sessions add constraint sessions_visibility_check
  check (visibility in ('everyone', 'friends', 'anonymous'));

alter table public.camp_rsvps add column if not exists visibility text not null default 'everyone';
alter table public.camp_rsvps drop constraint if exists camp_rsvps_visibility_check;
alter table public.camp_rsvps add constraint camp_rsvps_visibility_check
  check (visibility in ('everyone', 'friends', 'anonymous'));

-- Own profile (re-created so it returns the new column).
create or replace function public.my_profile()
returns setof public.profiles language sql stable security definer set search_path = public as $$
  select * from public.profiles where id = auth.uid();
$$;

-- Can the current member see this person's check-in or RSVP by name?
create or replace function public.can_see(owner uuid, vis text)
returns boolean language sql stable security definer set search_path = public as $$
  select owner = auth.uid()
      or (public.is_member()
          and not public.is_blocked(owner) and not public.blocked_me(owner)
          and (vis = 'everyone' or (vis = 'friends' and public.is_friend(owner))));
$$;

-- Tables: your own rows, plus rows you may see by name. Anonymous rows come only through the functions below.
drop policy if exists "members read sessions" on public.sessions;
create policy "members read sessions" on public.sessions for select using (public.can_see(user_id, visibility));
drop policy if exists "members read rsvps" on public.camp_rsvps;
create policy "members read rsvps" on public.camp_rsvps for select using (public.can_see(user_id, visibility));

-- ─── Reading check-ins and RSVPs ──────────────────────────────────────────
-- Who's out now (at one spot, or everywhere). Anonymous check-ins come back without a name or user id.
drop function if exists public.active_sessions(uuid);
create or replace function public.active_sessions(p_spot uuid default null)
returns table (
  id uuid, spot_id uuid, user_id uuid, activity text, details text[], note text,
  starts_at timestamptz, ends_at timestamptz, visibility text, display_name text, avatar_url text
)
language sql stable security definer set search_path = public as $$
  select s.id, s.spot_id,
         case when s.visibility = 'anonymous' and s.user_id <> auth.uid() then null else s.user_id end,
         s.activity, s.details, s.note, s.starts_at, s.ends_at, s.visibility,
         case when s.visibility = 'anonymous' and s.user_id <> auth.uid() then null else p.display_name end,
         case when s.visibility = 'anonymous' and s.user_id <> auth.uid() then null else p.avatar_url end
    from public.sessions s
    join public.profiles p on p.id = s.user_id
   where public.is_member()
     and s.starts_at <= now() and s.ends_at > now()
     and (p_spot is null or s.spot_id = p_spot)
     and (public.can_see(s.user_id, s.visibility)
          or (s.visibility = 'anonymous' and not public.is_blocked(s.user_id) and not public.blocked_me(s.user_id)))
   order by s.starts_at desc;
$$;
revoke execute on function public.active_sessions(uuid) from public, anon;
grant execute on function public.active_sessions(uuid) to authenticated;

-- Who's going to upcoming camp sessions between two dates. Anonymous RSVPs come back without a name or user id.
drop function if exists public.upcoming_rsvps(date, date, uuid);
create or replace function public.upcoming_rsvps(p_from date, p_to date, p_event uuid default null)
returns table (
  event_id uuid, occurs_on date, user_id uuid, visibility text, display_name text, avatar_url text, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select r.event_id, r.occurs_on,
         case when r.visibility = 'anonymous' and r.user_id <> auth.uid() then null else r.user_id end,
         r.visibility,
         case when r.visibility = 'anonymous' and r.user_id <> auth.uid() then null else p.display_name end,
         case when r.visibility = 'anonymous' and r.user_id <> auth.uid() then null else p.avatar_url end,
         r.created_at
    from public.camp_rsvps r
    join public.profiles p on p.id = r.user_id
   where public.is_member()
     and r.occurs_on between p_from and p_to
     and (p_event is null or r.event_id = p_event)
     and (public.can_see(r.user_id, r.visibility)
          or (r.visibility = 'anonymous' and not public.is_blocked(r.user_id) and not public.blocked_me(r.user_id)))
   order by r.created_at;
$$;
revoke execute on function public.upcoming_rsvps(date, date, uuid) from public, anon;
grant execute on function public.upcoming_rsvps(date, date, uuid) to authenticated;

-- For push alerts (server only): the friends of a member.
create or replace function public.friend_ids(p_user uuid)
returns table (id uuid) language sql stable security definer set search_path = public as $$
  select case when requester = p_user then addressee else requester end
    from public.friendships
   where status = 'accepted' and p_user in (requester, addressee);
$$;
revoke execute on function public.friend_ids(uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';
