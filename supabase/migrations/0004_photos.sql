-- Out Here — v0.4: photo galleries (max 99 per member) and jam cover photos
-- Paste into Supabase: SQL Editor → New query → Run. Run once, after 0003.

-- ─── Storage bucket for gallery photos and jam covers ─────────────────────
-- Files live under <user id>/gallery/… and <user id>/jams/…; each member writes only their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 10485760, array['image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do nothing;

create policy "members upload own photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text and public.is_member());
create policy "members replace own photos" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "members delete own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ─── Gallery ──────────────────────────────────────────────────────────────
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  url text not null,
  caption text check (char_length(caption) <= 280),
  spot_id uuid references public.spots (id) on delete set null,
  width integer,
  height integer,
  created_at timestamptz not null default now()
);
create index photos_user_idx on public.photos (user_id, created_at desc);

alter table public.photos enable row level security;
create policy "members see photos" on public.photos for select
  using (public.is_member() and not public.is_blocked(user_id));
create policy "add own photos" on public.photos for insert
  with check (public.is_member() and user_id = auth.uid());
create policy "edit own photos" on public.photos for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own photos" on public.photos for delete using (user_id = auth.uid());

-- Hard cap: 99 photos per member.
create or replace function public.enforce_photo_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('photos:' || new.user_id::text));
  if (select count(*) from public.photos where user_id = new.user_id) >= 99 then
    raise exception 'Your gallery is full (99 photos). Delete one to add another.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger photos_limit before insert on public.photos
  for each row execute function public.enforce_photo_limit();

-- ─── Jam cover photos ─────────────────────────────────────────────────────
alter table public.events add column if not exists cover_url text;

-- ─── Reports can point at photos too ──────────────────────────────────────
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('spot', 'review', 'event', 'session', 'profile', 'photo', 'message'));
