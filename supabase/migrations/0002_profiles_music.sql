-- Out Here — v0.2: profile photos + interests, music at jams
-- Paste into Supabase: SQL Editor → New query → Run. Safe to run once on top of 0001.

-- ─── Profiles: photo + interests ──────────────────────────────────────────
alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists interests text[] not null default '{}';

-- Other members may see these (location and push token stay private).
grant select (avatar_url, interests) on public.profiles to authenticated;

-- Public bucket for profile photos. Each member can only write inside a folder named after their user id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do nothing;

create policy "members upload own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text and public.is_member());
create policy "members replace own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "members delete own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ─── Jams: music ──────────────────────────────────────────────────────────
-- null = not specified, 'none' = no music, 'speaker' = someone brings a speaker, 'dj' = DJ set, 'live' = live musicians
alter table public.events
  add column if not exists music text check (music in ('none', 'speaker', 'dj', 'live'));

-- Let members edit jams nobody owns yet (e.g. the seeded ones) — the first editor claims them.
drop policy if exists "edit own events" on public.events;
create policy "edit own or unclaimed events" on public.events for update
  using (public.is_member() and (created_by = auth.uid() or created_by is null))
  with check (created_by = auth.uid());
