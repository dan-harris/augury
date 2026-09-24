begin;
select plan(21);

-- 1. Setup Auth Users & Allowlist
insert into auth.users (id, instance_id, email, role, aud)
values 
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'creator@example.com', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'regular@example.com', 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'admin2@example.com', 'authenticated', 'authenticated');

insert into group_creators (user_id) values ('11111111-1111-1111-1111-111111111111');

-- Test 1: create_group raises for non-allowlisted user
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "22222222-2222-2222-2222-222222222222"}';

select throws_ok(
  $$ select create_group('Invalid Group') $$,
  'Unauthorized: user is not a group creator',
  'create_group should raise for non-allowlisted user'
);

-- Test 2: create_group succeeds for allowlisted user
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111"}';

select lives_ok(
  $$ select create_group('Valid Group') $$,
  'create_group should succeed for allowlisted user'
);

-- Test 3: Verify group & admin created
set local role postgres;
select is(
  (select count(*)::int from groups where name = 'Valid Group'),
  1,
  'Group record should exist'
);

select is(
  (select count(*)::int from group_admins ga join groups g on g.id = ga.group_id where g.name = 'Valid Group' and ga.user_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'Creator should be added as group admin'
);

-- Test 4: Direct writes by anon should be rejected by RLS
set local role anon;

select throws_ok(
  $$ insert into groups (slug_id, name) values ('abc123', 'Anon Group') $$,
  'new row violates row-level security policy for table "groups"',
  'anon cannot insert into groups'
);

select throws_ok(
  $$ insert into votes (session_id, player_id, day) values ('sess1', '00000000-0000-0000-0000-000000000000', 1) $$,
  'new row violates row-level security policy for table "votes"',
  'anon cannot insert into votes directly'
);

select throws_ok(
  $$ insert into vote_responses (session_id, player_id) values ('sess1', '00000000-0000-0000-0000-000000000000') $$,
  'new row violates row-level security policy for table "vote_responses"',
  'anon cannot insert into vote_responses directly'
);

-- Setup test data for submit_votes, accept_invite, and last_admin test
set local role postgres;

-- Insert group 1, player 1, session 1
insert into groups (id, slug_id, name) values ('a0000000-0000-0000-0000-000000000001', 'group1', 'Group One');
insert into group_admins (group_id, user_id) values ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111');
insert into players (id, group_id, name) values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Player One');

-- Group 2 & Player 2 (different group)
insert into groups (id, slug_id, name) values ('a0000000-0000-0000-0000-000000000002', 'group2', 'Group Two');
insert into players (id, group_id, name) values ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Player Two');

-- Sessions: open sess1 in group 1 (candidate days 1, 2, 3), closed sess2 in group 1
insert into sessions (id, group_id, week_start, candidate_days, status) 
values ('sess1', 'a0000000-0000-0000-0000-000000000001', '2026-09-21', array[1, 2, 3]::smallint[], 'open');

insert into sessions (id, group_id, week_start, candidate_days, status) 
values ('sess2', 'a0000000-0000-0000-0000-000000000001', '2026-09-28', array[1, 2]::smallint[], 'closed');

-- Test 5: submit_votes rejects closed session
select throws_ok(
  $$ select submit_votes('sess2', 'b0000000-0000-0000-0000-000000000001', array[1]::smallint[]) $$,
  'Session is not open',
  'submit_votes rejects closed session'
);

-- Test 6: submit_votes rejects player from another group
select throws_ok(
  $$ select submit_votes('sess1', 'b0000000-0000-0000-0000-000000000002', array[1]::smallint[]) $$,
  'Player does not belong to session group',
  'submit_votes rejects player from another group'
);

-- Test 7: submit_votes rejects day not in candidate_days
select throws_ok(
  $$ select submit_votes('sess1', 'b0000000-0000-0000-0000-000000000001', array[5]::smallint[]) $$,
  'Submitted days must be candidate days of the session',
  'submit_votes rejects invalid candidate day'
);

-- Test 8: submit_votes succeeds and updates votes & vote_responses
select lives_ok(
  $$ select submit_votes('sess1', 'b0000000-0000-0000-0000-000000000001', array[1, 2]::smallint[]) $$,
  'submit_votes should succeed with valid parameters'
);

select is(
  (select count(*)::int from votes where session_id = 'sess1' and player_id = 'b0000000-0000-0000-0000-000000000001'),
  2,
  'Votes count should be 2'
);

select is(
  (select count(*)::int from vote_responses where session_id = 'sess1' and player_id = 'b0000000-0000-0000-0000-000000000001'),
  1,
  'Vote response record should exist'
);

-- Replace votes
select lives_ok(
  $$ select submit_votes('sess1', 'b0000000-0000-0000-0000-000000000001', array[3]::smallint[]) $$,
  'submit_votes should replace existing votes'
);

select is(
  (select array_agg(day) from votes where session_id = 'sess1' and player_id = 'b0000000-0000-0000-0000-000000000001'),
  array[3]::smallint[],
  'Votes should be updated to only day 3'
);

-- Test 9: accept_invite tests
set local role postgres;
insert into admin_invites (id, group_id, token, expires_at) 
values 
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'valid_token', now() + interval '1 hour'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'expired_token', now() - interval '1 hour');

set local role authenticated;
set local "request.jwt.claims" = '{"sub": "33333333-3333-3333-3333-333333333333"}';

select throws_ok(
  $$ select accept_invite('unknown_token') $$,
  'Invalid invite token',
  'accept_invite rejects unknown token'
);

select throws_ok(
  $$ select accept_invite('expired_token') $$,
  'Invite token expired',
  'accept_invite rejects expired token'
);

select lives_ok(
  $$ select accept_invite('valid_token') $$,
  'accept_invite consumes valid token'
);

set local role postgres;
select is(
  (select count(*)::int from group_admins where group_id = 'a0000000-0000-0000-0000-000000000001' and user_id = '33333333-3333-3333-3333-333333333333'),
  1,
  'User 3 should be added as admin'
);

-- Test 10: Last-admin delete trigger
delete from group_admins where group_id = 'a0000000-0000-0000-0000-000000000001' and user_id = '33333333-3333-3333-3333-333333333333';
select is(
  (select count(*)::int from group_admins where group_id = 'a0000000-0000-0000-0000-000000000001'),
  1,
  'Deleting non-last admin should succeed'
);

select throws_ok(
  $$ delete from group_admins where group_id = 'a0000000-0000-0000-0000-000000000001' and user_id = '11111111-1111-1111-1111-111111111111' $$,
  'Cannot remove the last admin of a group',
  'Deleting last admin raises exception'
);

select * from finish();
rollback;
