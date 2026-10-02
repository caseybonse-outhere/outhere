-- OUTHERENOW — v0.8: open to the public (no invite codes)
-- Paste into Supabase: SQL Editor → New query → Run. Run once.
-- Anyone who signs in with an email code can create a profile and use the app.

-- New members just pick a name.
create or replace function public.create_my_profile(p_display_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if char_length(trim(coalesce(p_display_name, ''))) = 0 then
    raise exception 'Add a name so people know what to call you';
  end if;
  insert into public.profiles (id, display_name)
  values (auth.uid(), left(trim(p_display_name), 40))
  on conflict (id) do nothing;
end;
$$;
revoke execute on function public.create_my_profile(text) from anon;

-- Invite codes are gone.
drop function if exists public.redeem_invite(text, text);
drop table if exists public.invites cascade;

notify pgrst, 'reload schema';
