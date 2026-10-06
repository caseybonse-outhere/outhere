-- Out Here Now — v0.10.2: delete spots
-- Paste into Supabase: SQL Editor → New query → Run. Safe to run more than once.
-- The person who added a spot could already delete it; this lets admins delete any spot.
-- Deleting a spot also deletes its camps, reviews, check-ins and line posts.

drop policy if exists "admins delete spots" on public.spots;
create policy "admins delete spots" on public.spots for delete using (public.is_admin());

notify pgrst, 'reload schema';
