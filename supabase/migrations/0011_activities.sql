-- Out Here Now — activities update
-- Paste into Supabase: SQL Editor → New query → Run. Safe to run more than once. Run after 0010.
--
-- • "Acro" is now "AcroYoga".
-- • "Flow Arts" is split into Poi, Rope Dart, Pixel Whip, Staff, Hoops and Flowstar.
--     Spots and camps tagged Flow Arts get all six props (their owners can trim the list).
--     Profiles drop Flow Arts; each person picks their own props.
-- • Activity details: Juggling (balls, clubs, wants to pass) and Staff (dragon staff),
--     saved on profiles and on "I'm out here now" check-ins, as "Juggling: Clubs" style tags.

-- ─── New columns ──────────────────────────────────────────────────────────
alter table public.profiles add column if not exists discipline_details text[] not null default '{}';
alter table public.sessions add column if not exists details text[] not null default '{}';

-- Everyone signed in can see profile details; each member edits their own.
grant select (discipline_details) on public.profiles to authenticated;
grant update (discipline_details) on public.profiles to authenticated;

-- Keep the lists short and the tags sensible.
alter table public.profiles drop constraint if exists profiles_discipline_details_len;
alter table public.profiles add constraint profiles_discipline_details_len
  check (coalesce(array_length(discipline_details, 1), 0) <= 20);
alter table public.sessions drop constraint if exists sessions_details_len;
alter table public.sessions add constraint sessions_details_len
  check (coalesce(array_length(details, 1), 0) <= 10);

-- Own profile (re-created so it returns the new column).
create or replace function public.my_profile()
returns setof public.profiles language sql stable security definer set search_path = public as $$
  select * from public.profiles where id = auth.uid();
$$;

-- ─── Rename Acro → AcroYoga ───────────────────────────────────────────────
update public.profiles set disciplines = array_replace(disciplines, 'Acro', 'AcroYoga') where 'Acro' = any(disciplines);
update public.spots    set disciplines = array_replace(disciplines, 'Acro', 'AcroYoga') where 'Acro' = any(disciplines);
update public.events   set disciplines = array_replace(disciplines, 'Acro', 'AcroYoga') where 'Acro' = any(disciplines);
update public.sessions set activity = 'AcroYoga' where activity = 'Acro';

-- ─── Flow Arts → the six props ────────────────────────────────────────────
update public.spots set disciplines =
  array_remove(disciplines, 'Flow Arts')
  || array(select p from unnest(array['Poi', 'Rope Dart', 'Pixel Whip', 'Staff', 'Hoops', 'Flowstar']) as p
           where not p = any(disciplines))
 where 'Flow Arts' = any(disciplines);

update public.events set disciplines =
  array_remove(disciplines, 'Flow Arts')
  || array(select p from unnest(array['Poi', 'Rope Dart', 'Pixel Whip', 'Staff', 'Hoops', 'Flowstar']) as p
           where not p = any(disciplines))
 where 'Flow Arts' = any(disciplines);

update public.profiles set disciplines = array_remove(disciplines, 'Flow Arts') where 'Flow Arts' = any(disciplines);

-- Check-ins expire within 12 hours; clear the old label rather than guess a prop.
update public.sessions set activity = null where activity = 'Flow Arts';

notify pgrst, 'reload schema';
