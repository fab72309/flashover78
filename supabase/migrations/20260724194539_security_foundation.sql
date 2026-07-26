create schema if not exists private;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select profile.is_admin
      from public.profiles as profile
      where profile.id = (select auth.uid())
    ),
    false
  );
$$;

revoke all on function private.is_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

create table if not exists public.profile_directory (
  id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null,
  first_name text,
  last_name text,
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.profile_directory (id, display_name, first_name, last_name)
select id, display_name, first_name, last_name
from public.profiles
on conflict (id) do update
set
  display_name = excluded.display_name,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  updated_at = timezone('utc', now());

create or replace function private.sync_profile_directory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profile_directory (id, display_name, first_name, last_name)
  values (new.id, new.display_name, new.first_name, new.last_name)
  on conflict (id) do update
  set
    display_name = excluded.display_name,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists profiles_sync_directory on public.profiles;
create trigger profiles_sync_directory
after insert or update of display_name, first_name, last_name on public.profiles
for each row execute function private.sync_profile_directory();

alter table public.profile_directory enable row level security;

drop policy if exists "profile_directory_select_authenticated" on public.profile_directory;
create policy "profile_directory_select_authenticated"
on public.profile_directory
for select
to authenticated
using (true);

revoke all on public.profile_directory from anon, authenticated;
grant select on public.profile_directory to authenticated;

drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_upsert_self" on public.profiles;
drop policy if exists "profiles_select_self_or_admin" on public.profiles;

create policy "profiles_select_self_or_admin"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or (select private.is_admin())
);

revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;

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
  synced_profile public.profiles;
begin
  if current_user_id is null then
    raise exception 'Authentification requise';
  end if;

  select auth_user.email
  into current_email
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
    false
  )
  on conflict (id) do update
  set
    email = current_email,
    display_name = excluded.display_name,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    phone = excluded.phone
  returning * into synced_profile;

  return synced_profile;
end;
$$;

revoke all on function public.sync_my_profile(text, text, text, text) from public;
grant execute on function public.sync_my_profile(text, text, text, text) to authenticated;

drop policy if exists "news_insert_admin_only" on public.news;
drop policy if exists "news_reads_manage_self" on public.news_reads;
drop policy if exists "news_select_authenticated" on public.news;
drop table if exists public.news_reads;
drop table if exists public.news;

update storage.buckets
set public = false
where id = 'news-images';

drop policy if exists "events_insert_admin_only" on public.events;
drop policy if exists "events_update_admin_only" on public.events;
drop policy if exists "events_delete_admin_only" on public.events;

create policy "events_insert_admin_only"
on public.events
for insert
to authenticated
with check ((select private.is_admin()));

create policy "events_update_admin_only"
on public.events
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "events_delete_admin_only"
on public.events
for delete
to authenticated
using ((select private.is_admin()));

drop policy if exists "resources_insert_admin_only" on public.resources;
drop policy if exists "resources_update_admin_only" on public.resources;
drop policy if exists "resources_delete_admin_only" on public.resources;

create policy "resources_insert_admin_only"
on public.resources
for insert
to authenticated
with check ((select private.is_admin()));

create policy "resources_update_admin_only"
on public.resources
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "resources_delete_admin_only"
on public.resources
for delete
to authenticated
using ((select private.is_admin()));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'carpool_trips_available_seats_lte_total'
      and conrelid = 'public.carpool_trips'::regclass
  ) then
    alter table public.carpool_trips
    add constraint carpool_trips_available_seats_lte_total
    check (available_seats <= total_seats);
  end if;
end
$$;

create unique index if not exists carpool_requests_one_active_per_user_trip
on public.carpool_requests (trip_id, requester_id)
where status in ('pending', 'accepted');

drop policy if exists "carpool_requests_select_authenticated" on public.carpool_requests;
drop policy if exists "carpool_requests_insert_requester" on public.carpool_requests;
drop policy if exists "carpool_requests_update_requester_or_driver" on public.carpool_requests;

create policy "carpool_requests_select_involved"
on public.carpool_requests
for select
to authenticated
using (
  requester_id = (select auth.uid())
  or exists (
    select 1
    from public.carpool_trips as trip
    where trip.id = carpool_requests.trip_id
      and trip.driver_id = (select auth.uid())
  )
  or (select private.is_admin())
);

revoke insert, update, delete on public.carpool_requests from authenticated;
grant select on public.carpool_requests to authenticated;

drop policy if exists "carpool_trips_update_driver" on public.carpool_trips;
revoke update, delete on public.carpool_trips from authenticated;

create or replace function public.create_carpool_request(
  p_trip_id uuid,
  p_seats_requested integer,
  p_message text default null
)
returns public.carpool_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_trip public.carpool_trips;
  created_request public.carpool_requests;
begin
  if current_user_id is null then
    raise exception 'Authentification requise';
  end if;

  if p_seats_requested < 1 then
    raise exception 'Le nombre de places doit être supérieur à zéro';
  end if;

  select *
  into target_trip
  from public.carpool_trips
  where id = p_trip_id
  for update;

  if not found then
    raise exception 'Trajet introuvable';
  end if;

  if target_trip.driver_id = current_user_id then
    raise exception 'Le conducteur ne peut pas demander une place sur son propre trajet';
  end if;

  if target_trip.status <> 'open' or target_trip.available_seats < p_seats_requested then
    raise exception 'Le trajet ne dispose pas de suffisamment de places';
  end if;

  insert into public.carpool_requests (
    trip_id,
    requester_id,
    seats_requested,
    message,
    status
  )
  values (
    p_trip_id,
    current_user_id,
    p_seats_requested,
    nullif(trim(p_message), ''),
    'pending'
  )
  returning * into created_request;

  return created_request;
end;
$$;

create or replace function public.respond_to_carpool_request(
  p_request_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_request public.carpool_requests;
  target_trip public.carpool_trips;
  remaining_seats integer;
begin
  if current_user_id is null then
    raise exception 'Authentification requise';
  end if;

  if p_status not in ('accepted', 'rejected') then
    raise exception 'Décision invalide';
  end if;

  select *
  into target_request
  from public.carpool_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Demande introuvable';
  end if;

  select *
  into target_trip
  from public.carpool_trips
  where id = target_request.trip_id
  for update;

  if target_trip.driver_id <> current_user_id then
    raise exception 'Action réservée au conducteur';
  end if;

  if target_request.status <> 'pending' then
    raise exception 'Cette demande a déjà été traitée';
  end if;

  if p_status = 'accepted' then
    if target_trip.status <> 'open'
      or target_trip.available_seats < target_request.seats_requested then
      raise exception 'Plus assez de places disponibles';
    end if;

    remaining_seats := target_trip.available_seats - target_request.seats_requested;

    update public.carpool_trips
    set
      available_seats = remaining_seats,
      status = case when remaining_seats = 0 then 'full' else 'open' end
    where id = target_trip.id;
  end if;

  update public.carpool_requests
  set status = p_status
  where id = target_request.id;
end;
$$;

create or replace function public.cancel_carpool_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_request public.carpool_requests;
  target_trip public.carpool_trips;
  restored_seats integer;
begin
  if current_user_id is null then
    raise exception 'Authentification requise';
  end if;

  select *
  into target_request
  from public.carpool_requests
  where id = p_request_id
  for update;

  if not found or target_request.requester_id <> current_user_id then
    raise exception 'Demande introuvable';
  end if;

  if target_request.status = 'cancelled' then
    return;
  end if;

  select *
  into target_trip
  from public.carpool_trips
  where id = target_request.trip_id
  for update;

  if target_request.status = 'accepted' and target_trip.status <> 'cancelled' then
    restored_seats := least(
      target_trip.total_seats,
      target_trip.available_seats + target_request.seats_requested
    );

    update public.carpool_trips
    set
      available_seats = restored_seats,
      status = case when restored_seats = 0 then 'full' else 'open' end
    where id = target_trip.id;
  end if;

  update public.carpool_requests
  set status = 'cancelled'
  where id = target_request.id;
end;
$$;

create or replace function public.cancel_carpool_trip(p_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentification requise';
  end if;

  update public.carpool_trips
  set status = 'cancelled'
  where id = p_trip_id
    and (
      driver_id = current_user_id
      or (select private.is_admin())
    );

  if not found then
    raise exception 'Trajet introuvable ou action non autorisée';
  end if;
end;
$$;

create or replace function public.get_carpool_contacts(p_trip_id uuid)
returns table (
  user_id uuid,
  email text,
  phone text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_trip public.carpool_trips;
begin
  if current_user_id is null then
    raise exception 'Authentification requise';
  end if;

  select *
  into target_trip
  from public.carpool_trips
  where id = p_trip_id;

  if not found then
    raise exception 'Trajet introuvable';
  end if;

  if target_trip.driver_id = current_user_id or (select private.is_admin()) then
    return query
    select profile.id, profile.email, profile.phone
    from public.profiles as profile
    where profile.id = target_trip.driver_id
      or profile.id in (
        select request.requester_id
        from public.carpool_requests as request
        where request.trip_id = p_trip_id
      );
    return;
  end if;

  if exists (
    select 1
    from public.carpool_requests as request
    where request.trip_id = p_trip_id
      and request.requester_id = current_user_id
      and request.status = 'accepted'
  ) then
    return query
    select profile.id, profile.email, profile.phone
    from public.profiles as profile
    where profile.id = target_trip.driver_id;
  end if;
end;
$$;

revoke all on function public.create_carpool_request(uuid, integer, text) from public;
revoke all on function public.respond_to_carpool_request(uuid, text) from public;
revoke all on function public.cancel_carpool_request(uuid) from public;
revoke all on function public.cancel_carpool_trip(uuid) from public;
revoke all on function public.get_carpool_contacts(uuid) from public;

grant execute on function public.create_carpool_request(uuid, integer, text) to authenticated;
grant execute on function public.respond_to_carpool_request(uuid, text) to authenticated;
grant execute on function public.cancel_carpool_request(uuid) to authenticated;
grant execute on function public.cancel_carpool_trip(uuid) to authenticated;
grant execute on function public.get_carpool_contacts(uuid) to authenticated;

update storage.buckets
set
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = array[
    'application/pdf',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'text/plain'
  ]
where id in (
  'sdis78-documents',
  'lectures-documents',
  'brulage-documents',
  'resources'
);

drop policy if exists "documents_select_authenticated" on storage.objects;
drop policy if exists "documents_insert_admin_only" on storage.objects;
drop policy if exists "documents_update_admin_only" on storage.objects;
drop policy if exists "documents_delete_admin_only" on storage.objects;

create policy "documents_select_authenticated"
on storage.objects
for select
to authenticated
using (
  bucket_id in (
    'sdis78-documents',
    'lectures-documents',
    'brulage-documents',
    'resources'
  )
);

create policy "documents_insert_admin_only"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in (
    'sdis78-documents',
    'lectures-documents',
    'brulage-documents',
    'resources'
  )
  and (select private.is_admin())
);

create policy "documents_update_admin_only"
on storage.objects
for update
to authenticated
using (
  bucket_id in (
    'sdis78-documents',
    'lectures-documents',
    'brulage-documents',
    'resources'
  )
  and (select private.is_admin())
)
with check (
  bucket_id in (
    'sdis78-documents',
    'lectures-documents',
    'brulage-documents',
    'resources'
  )
  and (select private.is_admin())
);

create policy "documents_delete_admin_only"
on storage.objects
for delete
to authenticated
using (
  bucket_id in (
    'sdis78-documents',
    'lectures-documents',
    'brulage-documents',
    'resources'
  )
  and (select private.is_admin())
);
