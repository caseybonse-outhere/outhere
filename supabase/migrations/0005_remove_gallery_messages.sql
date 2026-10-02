-- Out Here — v0.5: remove the photo gallery and direct messages
-- Paste into Supabase: SQL Editor → New query → Run. Run once, after 0004.
-- Jam cover photos and profile pictures are kept (the 'photos' and 'avatars' storage buckets stay).

-- ─── Direct messages ──────────────────────────────────────────────────────
drop function if exists public.my_threads();
drop table if exists public.messages cascade;   -- also removes it from realtime

-- ─── Photo gallery ────────────────────────────────────────────────────────
drop table if exists public.photos cascade;
drop function if exists public.enforce_photo_limit();

-- ─── Reports no longer point at photos or messages ────────────────────────
delete from public.reports where target_type in ('photo', 'message');
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('spot', 'review', 'event', 'session', 'profile'));
