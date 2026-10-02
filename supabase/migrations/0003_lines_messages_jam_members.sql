-- Out Here — v0.3: "the line is up", direct messages, jam communities
-- Paste into Supabase: SQL Editor → New query → Run. Run once, after 0002.

-- ─── Helpers ──────────────────────────────────────────────────────────────

-- True when either person has blocked the other.
create or replace function public.blocked_either(p_other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
     where (blocker_id = auth.uid() and blocked_id = p_other)
        or (blocker_id = p_other and blocked_id = auth.uid())
  );
$$;

-- ─── "The line is up" ─────────────────────────────────────────────────────

create table public.lines (
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
create index lines_active_idx on public.lines (spot_id, up_until);

alter table public.lines enable row level security;
create policy "members read lines" on public.lines for select
  using (public.is_member() and not public.is_blocked(user_id));
create policy "post own line" on public.lines for insert
  with check (public.is_member() and user_id = auth.uid());
create policy "take down own line" on public.lines for delete using (user_id = auth.uid());

-- ─── Direct messages ──────────────────────────────────────────────────────

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);
create index messages_pair_idx on public.messages
  (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at desc);
create index messages_unread_idx on public.messages (recipient_id) where read_at is null;

alter table public.messages enable row level security;
create policy "read own messages" on public.messages for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy "send messages" on public.messages for insert
  with check (sender_id = auth.uid() and public.is_member() and not public.blocked_either(recipient_id));
create policy "mark received messages read" on public.messages for update
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
-- Recipients may only change read_at, never the text.
revoke update on public.messages from authenticated;
grant update (read_at) on public.messages to authenticated;

-- Inbox: one row per conversation, newest first.
create or replace function public.my_threads()
returns table (
  other_id uuid,
  display_name text,
  avatar_url text,
  last_body text,
  last_at timestamptz,
  last_from_me boolean,
  unread integer
)
language sql stable security definer set search_path = public as $$
  with mine as (
    select m.*,
           case when m.sender_id = auth.uid() then m.recipient_id else m.sender_id end as peer
      from public.messages m
     where m.sender_id = auth.uid() or m.recipient_id = auth.uid()
  ),
  latest as (
    select distinct on (peer) peer, body, created_at, (sender_id = auth.uid()) as from_me
      from mine
     order by peer, created_at desc
  )
  select l.peer, p.display_name, p.avatar_url, l.body, l.created_at, l.from_me,
         (select count(*)::int from mine u
           where u.peer = l.peer and u.recipient_id = auth.uid() and u.read_at is null)
    from latest l
    join public.profiles p on p.id = l.peer
   where not public.is_blocked(l.peer)
   order by l.created_at desc;
$$;

-- Live delivery of new messages to the app.
alter publication supabase_realtime add table public.messages;

-- ─── Jam communities ──────────────────────────────────────────────────────

create table public.jam_members (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'organizer')),
  joined_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index jam_members_user_idx on public.jam_members (user_id);

alter table public.jam_members enable row level security;
create policy "members read jam members" on public.jam_members for select
  using (public.is_member() and not public.is_blocked(user_id));
create policy "join jams" on public.jam_members for insert
  with check (user_id = auth.uid() and public.is_member() and role = 'member');
create policy "leave jams" on public.jam_members for delete using (user_id = auth.uid());

-- Whoever creates (or claims) a jam becomes its organizer automatically.
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
create trigger events_add_organizer
  after insert or update of created_by on public.events
  for each row execute function public.add_jam_organizer();

-- Existing jams that already have an organizer.
insert into public.jam_members (event_id, user_id, role)
select id, created_by, 'organizer' from public.events where created_by is not null
on conflict do nothing;
