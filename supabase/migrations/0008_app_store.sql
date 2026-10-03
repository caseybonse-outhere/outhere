-- OUTHERENOW — v0.9: App Store readiness
-- Paste into Supabase: SQL Editor → New query → Run. Safe to run more than once.
--
-- • Members agree to the Terms before they can see or post anything.
-- • Admins (you) can review reports, remove content and ban accounts.
-- • Blocking someone also hides the camps they organize.
-- • Deleting an account also deletes the camps that person started.
-- • Members can message support from the Me tab.
-- • Members can only change their own everyday profile fields (not admin / ban / terms).
--
-- After running it, make yourself an admin (swap in your sign-in email):
--   update public.profiles set is_admin = true
--    where id = (select id from auth.users where email = 'you@example.com');

-- ─── Profile columns ──────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists is_admin boolean not null default false,
  add column if not exists banned_at timestamptz;

-- Members may only update these columns on their own row.
revoke update on public.profiles from authenticated, anon;
grant update (display_name, disciplines, bio, alerts_enabled, alert_radius_miles,
              home_lat, home_lng, push_token, avatar_url, interests)
  on public.profiles to authenticated;

-- Emails of banned accounts, so a ban survives deleting and re-creating the account.
create table if not exists public.banned_emails (
  email text primary key,
  banned_at timestamptz not null default now()
);
alter table public.banned_emails enable row level security;   -- no policies: only security-definer functions touch it

-- ─── Membership ───────────────────────────────────────────────────────────
-- A member has a profile, has agreed to the Terms, and isn't banned.
create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and terms_accepted_at is not null and banned_at is null
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_admin and banned_at is null);
$$;

create or replace function public.my_profile()
returns setof public.profiles language sql stable security definer set search_path = public as $$
  select * from public.profiles where id = auth.uid();
$$;

-- New members pick a name and agree to the Terms in one step.
drop function if exists public.create_my_profile(text);
create or replace function public.create_my_profile(p_display_name text, p_accept_terms boolean default false)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if not coalesce(p_accept_terms, false) then
    raise exception 'Please agree to the Terms to continue';
  end if;
  if char_length(trim(coalesce(p_display_name, ''))) = 0 then
    raise exception 'Add a name so people know what to call you';
  end if;
  if exists (select 1 from public.banned_emails b join auth.users u on lower(u.email) = b.email where u.id = auth.uid()) then
    raise exception 'This account can’t be used with OUTHERENOW';
  end if;
  insert into public.profiles (id, display_name, terms_accepted_at)
  values (auth.uid(), left(trim(p_display_name), 40), now())
  on conflict (id) do update set terms_accepted_at = coalesce(public.profiles.terms_accepted_at, now());
end;
$$;
revoke execute on function public.create_my_profile(text, boolean) from anon;

-- Members who joined before v0.9 agree here.
create or replace function public.accept_terms()
returns void language sql security definer set search_path = public as $$
  update public.profiles set terms_accepted_at = now()
   where id = auth.uid() and terms_accepted_at is null;
$$;
revoke execute on function public.accept_terms() from anon;

-- ─── Camps: hide blocked organizers; only owners (or admins) edit ─────────
drop policy if exists "members read events" on public.events;
create policy "members read events" on public.events for select
  using (public.is_member() and not public.is_blocked(created_by));

drop policy if exists "edit own or unclaimed events" on public.events;
drop policy if exists "edit own events" on public.events;
drop policy if exists "admins edit events" on public.events;
drop policy if exists "admins delete events" on public.events;
create policy "edit own events" on public.events for update
  using (public.is_member() and created_by = auth.uid())
  with check (created_by = auth.uid());
create policy "admins edit events" on public.events for update
  using (public.is_admin()) with check (true);
create policy "admins delete events" on public.events for delete using (public.is_admin());

-- ─── Reports ──────────────────────────────────────────────────────────────
alter table public.reports
  add column if not exists status text not null default 'open',
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references public.profiles (id) on delete set null;
alter table public.reports drop constraint if exists reports_status_check;
alter table public.reports add constraint reports_status_check
  check (status in ('open', 'removed', 'dismissed'));
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('spot', 'review', 'event', 'session', 'profile', 'line'));
drop policy if exists "admins read reports" on public.reports;
create policy "admins read reports" on public.reports for select using (public.is_admin());
create index if not exists reports_open_idx on public.reports (created_at) where status = 'open';

-- Who owns a piece of reported content, and a short preview of it.
create or replace function public.report_target(p_type text, p_id uuid, out owner_id uuid, out preview text)
language plpgsql stable security definer set search_path = public as $$
begin
  case p_type
    when 'spot' then
      select s.created_by, s.name || coalesce(' — ' || s.notes, '') into owner_id, preview from public.spots s where s.id = p_id;
    when 'review' then
      select r.user_id, r.rating::text || '/5' || coalesce(' — ' || r.body, '') into owner_id, preview from public.spot_reviews r where r.id = p_id;
    when 'event' then
      select e.created_by, e.name || coalesce(' — ' || e.description, '') || case when e.cover_url is not null then ' [has photo]' else '' end
        into owner_id, preview from public.events e where e.id = p_id;
    when 'session' then
      select x.user_id, coalesce(x.activity, 'Check-in') || coalesce(' — ' || x.note, '') into owner_id, preview from public.sessions x where x.id = p_id;
    when 'line' then
      select l.user_id, l.line_type || coalesce(' — ' || l.note, '') into owner_id, preview from public.lines l where l.id = p_id;
    when 'profile' then
      select p.id, p.display_name || coalesce(' — ' || p.bio, '') || case when p.avatar_url is not null then ' [has photo]' else '' end
        into owner_id, preview from public.profiles p where p.id = p_id;
    else null;
  end case;
end;
$$;
revoke execute on function public.report_target(text, uuid) from public, anon, authenticated;

-- Open reports for the moderation screen (admins only).
create or replace function public.admin_open_reports()
returns table (id uuid, target_type text, target_id uuid, reason text, created_at timestamptz,
               reporter_name text, owner_id uuid, owner_name text, owner_banned boolean, preview text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
    select r.id, r.target_type, r.target_id, r.reason, r.created_at,
           rp.display_name, t.owner_id, op.display_name, op.banned_at is not null,
           coalesce(t.preview, '(already removed)')
      from public.reports r
      left join public.profiles rp on rp.id = r.reporter_id
      cross join lateral public.report_target(r.target_type, r.target_id) t
      left join public.profiles op on op.id = t.owner_id
     where r.status = 'open'
     order by r.created_at;
end;
$$;

-- Remove the reported content and close every open report about it.
create or replace function public.admin_remove(p_report uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.reports;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select * into r from public.reports where id = p_report;
  if not found then raise exception 'Report not found'; end if;
  case r.target_type
    when 'spot'    then delete from public.spots where id = r.target_id;
    when 'review'  then delete from public.spot_reviews where id = r.target_id;
    when 'event'   then delete from public.events where id = r.target_id;
    when 'session' then delete from public.sessions where id = r.target_id;
    when 'line'    then delete from public.lines where id = r.target_id;
    when 'profile' then update public.profiles set bio = null, avatar_url = null where id = r.target_id;
  end case;
  update public.reports set status = 'removed', resolved_at = now(), resolved_by = auth.uid()
   where target_type = r.target_type and target_id = r.target_id and status = 'open';
end;
$$;

create or replace function public.admin_dismiss(p_report uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update public.reports set status = 'dismissed', resolved_at = now(), resolved_by = auth.uid()
   where id = p_report and status = 'open';
end;
$$;

-- Ban an account: it loses access, its posts come down, and its email can't sign up again.
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
end;
$$;

revoke execute on function public.admin_open_reports() from anon;
revoke execute on function public.admin_remove(uuid) from anon;
revoke execute on function public.admin_dismiss(uuid) from anon;
revoke execute on function public.admin_ban(uuid) from anon;

-- ─── Account deletion also removes camps you started ─────────────────────
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from public.events where created_by = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;
revoke execute on function public.delete_my_account() from anon;

-- Let members list their own uploaded files (the app deletes them before deleting the account).
drop policy if exists "members list own files" on storage.objects;
create policy "members list own files" on storage.objects for select to authenticated
  using (bucket_id in ('avatars', 'photos') and (storage.foldername(name))[1] = auth.uid()::text);

-- ─── Contact support from inside the app ─────────────────────────────────
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.support_messages enable row level security;
drop policy if exists "send support messages" on public.support_messages;
create policy "send support messages" on public.support_messages for insert to authenticated
  with check (user_id = auth.uid());

notify pgrst, 'reload schema';
