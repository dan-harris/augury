-- Migration 0001: Augury DB Schema, RLS Policies, Helper Functions, RPCs, Triggers, Tallies View, Realtime

-- 1. Types & Enums
create type session_status as enum ('open', 'confirmed', 'closed');

-- 2. Tables
create table groups (
  id uuid primary key default gen_random_uuid(),
  slug_id text not null unique check (slug_id ~ '^[a-z0-9]{6}$'),
  name text not null,
  viability_threshold int not null default 4 check (viability_threshold >= 1),
  created_at timestamptz not null default now()
);

create table group_admins (
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (group_id, user_id)
);

create table group_creators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table admin_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  name text not null,
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (group_id, name)
);

create table sessions (
  id text primary key,                  -- short public id (nanoid ~10 chars), generated app-side
  group_id uuid not null references groups(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  candidate_days smallint[] not null check (cardinality(candidate_days) >= 1),
  status session_status not null default 'open',
  confirmed_day smallint,
  created_at timestamptz not null default now(),
  check ((status = 'confirmed') = (confirmed_day is not null))
);

create table votes (
  session_id text not null references sessions(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  day smallint not null,
  primary key (session_id, player_id, day)
);

create table vote_responses (
  session_id text not null references sessions(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (session_id, player_id)
);

-- 3. Views
create view session_day_tallies with (security_invoker = true) as
select s.id as session_id, d.day,
       count(v.player_id) as yes_count,
       coalesce(array_agg(v.player_id) filter (where v.player_id is not null), '{}') as voter_ids,
       count(v.player_id) >= g.viability_threshold as viable
from sessions s
join groups g on g.id = s.group_id
cross join lateral unnest(s.candidate_days) as d(day)
left join votes v on v.session_id = s.id and v.day = d.day
group by s.id, d.day, g.viability_threshold;

-- 4. Helper Functions
create or replace function is_group_admin(p_group_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from group_admins
    where group_id = p_group_id and user_id = auth.uid()
  );
$$;

-- 5. Row Level Security
alter table groups enable row level security;
alter table group_admins enable row level security;
alter table group_creators enable row level security;
alter table admin_invites enable row level security;
alter table players enable row level security;
alter table sessions enable row level security;
alter table votes enable row level security;
alter table vote_responses enable row level security;

-- Policies
create policy "groups_select" on groups for select using (true);
create policy "groups_update" on groups for update using (is_group_admin(id));
create policy "groups_delete" on groups for delete using (is_group_admin(id));

create policy "group_admins_select" on group_admins for select using (is_group_admin(group_id));
create policy "group_admins_delete" on group_admins for delete using (is_group_admin(group_id));

create policy "group_creators_select" on group_creators for select using (user_id = auth.uid());

create policy "admin_invites_select" on admin_invites for select using (is_group_admin(group_id));
create policy "admin_invites_insert" on admin_invites for insert with check (is_group_admin(group_id));
create policy "admin_invites_delete" on admin_invites for delete using (is_group_admin(group_id));

create policy "players_select" on players for select using (true);
create policy "players_insert" on players for insert with check (is_group_admin(group_id));
create policy "players_update" on players for update using (is_group_admin(group_id));
create policy "players_delete" on players for delete using (is_group_admin(group_id));

create policy "sessions_select" on sessions for select using (true);
create policy "sessions_insert" on sessions for insert with check (is_group_admin(group_id));
create policy "sessions_update" on sessions for update using (is_group_admin(group_id));
create policy "sessions_delete" on sessions for delete using (is_group_admin(group_id));

create policy "votes_select" on votes for select using (true);
create policy "vote_responses_select" on vote_responses for select using (true);

-- 6. RPCs
create or replace function create_group(p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_slug text;
  v_group_id uuid;
  v_chars text := '23456789abcdefghjkmnpqrstuvwxyz';
  v_len int := length(v_chars);
  i int;
  v_tries int := 0;
begin
  if v_user_id is null or not exists (select 1 from group_creators where user_id = v_user_id) then
    raise exception 'Unauthorized: user is not a group creator';
  end if;

  loop
    v_slug := '';
    for i in 1..6 loop
      v_slug := v_slug || substr(v_chars, floor(random() * v_len)::int + 1, 1);
    end loop;

    begin
      insert into groups (slug_id, name)
      values (v_slug, p_name)
      returning id into v_group_id;

      exit;
    exception when unique_violation then
      v_tries := v_tries + 1;
      if v_tries > 10 then
        raise exception 'Could not generate unique slug_id';
      end if;
    end;
  end loop;

  insert into group_admins (group_id, user_id)
  values (v_group_id, v_user_id);

  return v_slug;
end;
$$;

revoke execute on function create_group(text) from public;
grant execute on function create_group(text) to authenticated;

create or replace function accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite record;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select * into v_invite from admin_invites where token = p_token;
  if not found then
    raise exception 'Invalid invite token';
  end if;

  if v_invite.expires_at < now() then
    raise exception 'Invite token expired';
  end if;

  insert into group_admins (group_id, user_id)
  values (v_invite.group_id, v_user_id)
  on conflict (group_id, user_id) do nothing;

  delete from admin_invites where id = v_invite.id;

  return v_invite.group_id;
end;
$$;

revoke execute on function accept_invite(text) from public;
grant execute on function accept_invite(text) to authenticated;

create or replace function submit_votes(
  p_session_id text,
  p_player_id uuid,
  p_days smallint[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session sessions%rowtype;
  v_player_group_id uuid;
  v_day smallint;
begin
  select * into v_session from sessions where id = p_session_id;
  if not found then
    raise exception 'Session not found';
  end if;

  if v_session.status != 'open' then
    raise exception 'Session is not open';
  end if;

  select group_id into v_player_group_id from players where id = p_player_id;
  if not found or v_player_group_id != v_session.group_id then
    raise exception 'Player does not belong to session group';
  end if;

  if not (p_days <@ v_session.candidate_days) then
    raise exception 'Submitted days must be candidate days of the session';
  end if;

  delete from votes where session_id = p_session_id and player_id = p_player_id;

  if coalesce(cardinality(p_days), 0) > 0 then
    foreach v_day in array p_days loop
      insert into votes (session_id, player_id, day)
      values (p_session_id, p_player_id, v_day);
    end loop;
  end if;

  insert into vote_responses (session_id, player_id, updated_at)
  values (p_session_id, p_player_id, now())
  on conflict (session_id, player_id)
  do update set updated_at = now();
end;
$$;

revoke execute on function submit_votes(text, uuid, smallint[]) from public;
grant execute on function submit_votes(text, uuid, smallint[]) to anon, authenticated;

-- 7. Triggers
create or replace function check_last_admin_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  select count(*) into v_count
  from group_admins
  where group_id = old.group_id;

  if v_count <= 1 then
    raise exception 'Cannot remove the last admin of a group';
  end if;

  return old;
end;
$$;

create trigger prevent_last_admin_delete
before delete on group_admins
for each row
execute function check_last_admin_delete();

-- 8. Realtime Publication
alter publication supabase_realtime add table votes, vote_responses, sessions;
