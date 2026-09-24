-- Migration 0002: Link & Unlink Player RPCs

create or replace function link_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_player players%rowtype;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select * into v_player from players where id = p_player_id;
  if not found then
    raise exception 'Player not found';
  end if;

  if v_player.user_id is not null then
    raise exception 'Player is already linked to a user';
  end if;

  if exists (
    select 1 from players
    where group_id = v_player.group_id and user_id = v_user_id
  ) then
    raise exception 'User is already linked to a player in this group';
  end if;

  update players
  set user_id = v_user_id
  where id = p_player_id and user_id is null;
end;
$$;

revoke execute on function link_player(uuid) from public;
grant execute on function link_player(uuid) to authenticated;

create or replace function unlink_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_player players%rowtype;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select * into v_player from players where id = p_player_id;
  if not found then
    raise exception 'Player not found';
  end if;

  if not (is_group_admin(v_player.group_id) or v_player.user_id = v_user_id) then
    raise exception 'Unauthorized: caller is neither group admin nor the linked user';
  end if;

  update players
  set user_id = null
  where id = p_player_id;
end;
$$;

revoke execute on function unlink_player(uuid) from public;
grant execute on function unlink_player(uuid) to authenticated;
