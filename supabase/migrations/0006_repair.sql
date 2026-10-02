-- OUTHERENOW — repair: make sure everything the app needs exists.
-- Safe to run more than once, and safe whether or not 0003 / 0004 ran before.
-- Paste into Supabase: SQL Editor → New query → Run.

-- ─── Helpers ──────────────────────────────────────────────────────────────
create or replace function public.blocked_either(p_other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
     where (blocker_id = auth.uid() and blocked_id = p_other)
        or (blocker_id = p_other and blocked_id = auth.uid())
  );
$$;

-- ─── Jam columns (from 0002 / 0004) ───────────────────────────────────────
alter table public.events add column if not exists music text;
alter table public.events add column if not exists cover_url text;

-- ─── "The line is up" ─────────────────────────────────────────────────────
create table if not exists public.lines (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references public.spots (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  line_type text not null default 'slackline'
    check (line_type in ('slackline', 'trickline', 'longline', 'highline', 'waterline', 'rodeo')),
  length_ft integer check (length_ft between 5 and 5000),
  note text check (char_length(note) <= 200),
  up_until timestamptz not null,
  created_at timestamptz not null default now(),
  check (up_until > created_at and up_until <= created_at + interval '12 hours')
);
create index if not exists lines_active_idx on public.lines (spot_id, up_until);
alter table public.lines enable row level security;
drop policy if exists "members read lines" on public.lines;
drop policy if exists "post own line" on public.lines;
drop policy if exists "take down own line" on public.lines;
create policy "members read lines" on public.lines for select
  using (public.is_member() and not public.is_blocked(user_id));
create policy "post own line" on public.lines for insert
  with check (public.is_member() and user_id = auth.uid());
create policy "take down own line" on public.lines for delete using (user_id = auth.uid());

-- ─── Jam communities ──────────────────────────────────────────────────────
create table if not exists public.jam_members (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'organizer')),
  joined_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index if not exists jam_members_user_idx on public.jam_members (user_id);
alter table public.jam_members enable row level security;
drop policy if exists "members read jam members" on public.jam_members;
drop policy if exists "join jams" on public.jam_members;
drop policy if exists "leave jams" on public.jam_members;
create policy "members read jam members" on public.jam_members for select
  using (public.is_member() and not public.is_blocked(user_id));
create policy "join jams" on public.jam_members for insert
  with check (user_id = auth.uid() and public.is_member() and role = 'member');
create policy "leave jams" on public.jam_members for delete using (user_id = auth.uid());

create or replace function public.add_jam_organizer()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null and (tg_op = 'INSERT' or old.created_by is distinct from new.created_by) then
    insert into public.jam_members (event_id, user_id, role)
    values (new.id, new.created_by, 'organizer')
    on conflict (event_id, user_id) do update set role = 'organizer';
  end if;
  return new;
end;
$$;
drop trigger if exists events_add_organizer on public.events;
create trigger events_add_organizer
  after insert or update of created_by on public.events
  for each row execute function public.add_jam_organizer();

-- Organizers for jams that already exist.
insert into public.jam_members (event_id, user_id, role)
select id, created_by, 'organizer' from public.events where created_by is not null
on conflict do nothing;

-- ─── Storage for jam cover photos (from 0004) ─────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 10485760, array['image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "members upload own photos" on storage.objects;
drop policy if exists "members replace own photos" on storage.objects;
drop policy if exists "members delete own photos" on storage.objects;
create policy "members upload own photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text and public.is_member());
create policy "members replace own photos" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "members delete own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Tell the API about the new tables right away.
notify pgrst, 'reload schema';
