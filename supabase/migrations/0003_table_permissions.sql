-- Migration 0003: Grant least-privilege SQL table and view permissions for PostgREST / Supabase API

-- 1. Ensure schema usage
grant usage on schema public to anon, authenticated;

-- 2. group_creators: Read-only for authenticated users (allowlist check)
grant select on public.group_creators to authenticated;

-- 3. groups: Public read, admin update/delete (insert via create_group RPC)
grant select on public.groups to anon, authenticated;
grant update, delete on public.groups to authenticated;

-- 4. group_admins: Read & delete for authenticated users
grant select, delete on public.group_admins to authenticated;

-- 5. admin_invites: Select, insert, delete for authenticated users
grant select, insert, delete on public.admin_invites to authenticated;

-- 6. players: Public read, admin write
grant select on public.players to anon, authenticated;
grant insert, update, delete on public.players to authenticated;

-- 7. sessions: Public read, admin write
grant select on public.sessions to anon, authenticated;
grant insert, update, delete on public.sessions to authenticated;

-- 8. votes & vote_responses: Public read (writes via submit_votes RPC)
grant select on public.votes to anon, authenticated;
grant select on public.vote_responses to anon, authenticated;

-- 9. session_day_tallies: Public view read
grant select on public.session_day_tallies to anon, authenticated;
