create or replace function public.sync_my_profile(
  p_display_name text,
  p_first_name text default null,
  p_last_name text default null,
  p_phone text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_email text;
  should_be_admin boolean := false;
  synced_profile public.profiles;
begin
  if current_user_id is null then
    raise exception 'Authentification requise';
  end if;

  select
    auth_user.email,
    auth_user.id = (
      select oldest_user.id
      from auth.users as oldest_user
      order by oldest_user.created_at asc, oldest_user.id asc
      limit 1
    )
  into current_email, should_be_admin
  from auth.users as auth_user
  where auth_user.id = current_user_id;

  if current_email is null then
    raise exception 'Compte utilisateur introuvable';
  end if;

  insert into public.profiles (
    id,
    email,
    display_name,
    first_name,
    last_name,
    phone,
    is_admin
  )
  values (
    current_user_id,
    current_email,
    nullif(trim(p_display_name), ''),
    nullif(trim(p_first_name), ''),
    nullif(trim(p_last_name), ''),
    nullif(trim(p_phone), ''),
    should_be_admin
  )
  on conflict (id) do update
  set
    email = current_email,
    display_name = excluded.display_name,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    phone = excluded.phone,
    is_admin = public.profiles.is_admin
      or (
        should_be_admin
        and not exists (
          select 1
          from public.profiles as admin_profile
          where admin_profile.is_admin
        )
      )
  returning * into synced_profile;

  return synced_profile;
end;
$$;

revoke all on function public.sync_my_profile(text, text, text, text) from public, anon;
grant execute on function public.sync_my_profile(text, text, text, text) to authenticated;
