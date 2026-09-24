begin;
select plan(7);

-- 1. Setup Auth Users & Group & Players (using valid hex UUIDs)
insert into auth.users (id, instance_id, email, role, aud)
values 
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'voter1@example.com', 'authenticated', 'authenticated'),
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'voter2@example.com', 'authenticated', 'authenticated');

insert into groups (id, slug_id, name) values ('66666666-6666-6666-6666-666666666666', 'grp111', 'Group Link Test');

insert into players (id, group_id, name)
values 
  ('77777777-7777-7777-7777-777777777777', '66666666-6666-6666-6666-666666666666', 'Player Alpha'),
  ('88888888-8888-8888-8888-888888888888', '66666666-6666-6666-6666-666666666666', 'Player Beta');

-- Test 1: link_player fails for anon / unauthenticated
set local role anon;
select throws_ok(
  $$ select link_player('77777777-7777-7777-7777-777777777777'::uuid) $$,
  'Unauthorized',
  'link_player rejects unauthenticated call'
);

-- Test 2: link_player succeeds for voter1 linking to Player Alpha
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "44444444-4444-4444-4444-444444444444"}';

select lives_ok(
  $$ select link_player('77777777-7777-7777-7777-777777777777'::uuid) $$,
  'voter1 links to Player Alpha successfully'
);

set local role postgres;
select is(
  (select user_id from players where id = '77777777-7777-7777-7777-777777777777'),
  '44444444-4444-4444-4444-444444444444'::uuid,
  'Player Alpha should be linked to voter1'
);

-- Test 3: voter2 attempting to link to already-linked Player Alpha fails
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "55555555-5555-5555-5555-555555555555"}';

select throws_ok(
  $$ select link_player('77777777-7777-7777-7777-777777777777'::uuid) $$,
  'Player is already linked to a user',
  'Cannot link to an already linked player'
);

-- Test 4: voter1 attempting to link to second player (Player Beta) in same group fails
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "44444444-4444-4444-4444-444444444444"}';

select throws_ok(
  $$ select link_player('88888888-8888-8888-8888-888888888888'::uuid) $$,
  'User is already linked to a player in this group',
  'User cannot link to multiple players in same group'
);

-- Test 5: unlink_player succeeds for linked user
select lives_ok(
  $$ select unlink_player('77777777-7777-7777-7777-777777777777'::uuid) $$,
  'Linked user can unlink themselves'
);

set local role postgres;
select is(
  (select user_id from players where id = '77777777-7777-7777-7777-777777777777'),
  null,
  'Player Alpha should now be unlinked'
);

select * from finish();
rollback;
