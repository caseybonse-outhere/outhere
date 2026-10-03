-- OUTHERENOW — v0.10: "Going this week" and meeting-point pins
-- Paste into Supabase: SQL Editor → New query → Run. Safe to run more than once. Run after 0008.

-- ─── Meeting-point pins ───────────────────────────────────────────────────
-- A camp can mark exactly where people meet ("by the rings, south end"),
-- and a line post can mark where the line is rigged. These mark places, never people.
alter table public.events
  add column if not exists meet_lat double precision,
  add column if not exists meet_lng double precision,
  add column if not exists meet_note text;
alter table public.events drop constraint if exists events_meet_note_len;
alter table public.events add constraint events_meet_note_len check (char_length(meet_note) <= 120);

alter table public.lines
  add column if not exists pin_lat double precision,
  add column if not exists pin_lng double precision;

-- ─── "Going this week" ────────────────────────────────────────────────────
-- One row per person per camp session (the local date the session starts).
create table if not exists public.camp_rsvps (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  occurs_on date not null,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id, occurs_on)
);
create index if not exists camp_rsvps_date_idx on public.camp_rsvps (occurs_on, event_id);
alter table public.camp_rsvps enable row level security;
drop policy if exists "members read rsvps" on public.camp_rsvps;
drop policy if exists "rsvp for yourself" on public.camp_rsvps;
drop policy if exists "cancel own rsvp" on public.camp_rsvps;
create policy "members read rsvps" on public.camp_rsvps for select
  using (public.is_member() and not public.is_blocked(user_id));
create policy "rsvp for yourself" on public.camp_rsvps for insert
  with check (public.is_member() and user_id = auth.uid()
              and occurs_on between current_date - 1 and current_date + 30);
create policy "cancel own rsvp" on public.camp_rsvps for delete using (user_id = auth.uid());

-- Banning someone also clears their RSVPs (same as 0008, plus camp_rsvps).
create or replace function public.admin_ban(p_user uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_user = auth.uid() then raise exception 'You can’t ban yourself'; end if;
  update public.profiles set banned_at = now(), push_token = null, is_admin = false where id = p_user;
  insert into public.banned_emails (email)
    select lower(email) from auth.users where id = p_user and email is not null
  on conflict do nothing;
  -- Close their open reports first, while the content still exists to match on.
  update public.reports r set status = 'removed', resolved_at = now(), resolved_by = auth.uid()
   where r.status = 'open'
     and (select t.owner_id from public.report_target(r.target_type, r.target_id) t) is not distinct from p_user;
  update public.reports set status = 'removed', resolved_at = now(), resolved_by = auth.uid()
   where status = 'open' and target_type = 'profile' and target_id = p_user;
  delete from public.sessions where user_id = p_user;
  delete from public.lines where user_id = p_user;
  delete from public.spot_reviews where user_id = p_user;
  delete from public.events where created_by = p_user;
  delete from public.jam_members where user_id = p_user;
  delete from public.camp_rsvps where user_id = p_user;
end;
$$;
revoke execute on function public.admin_ban(uuid) from anon;

notify pgrst, 'reload schema';
