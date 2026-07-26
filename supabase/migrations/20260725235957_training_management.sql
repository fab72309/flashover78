alter table public.events
add column if not exists capacity integer not null default 12;

alter table public.events
add column if not exists registration_closes_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_capacity_range'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
    add constraint events_capacity_range
    check (capacity between 1 and 500);
  end if;
end
$$;

create table if not exists public.training_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('registered', 'waitlisted', 'cancelled')),
  attendance text not null default 'pending'
    check (attendance in ('pending', 'present', 'absent')),
  registered_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (event_id, user_id)
);

create table if not exists public.training_audit_log (
  id bigint generated always as identity primary key,
  event_id uuid references public.events(id) on delete set null,
  registration_id uuid references public.training_registrations(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists training_registrations_event_status_registered_at
on public.training_registrations (event_id, status, registered_at);

create index if not exists training_registrations_user_updated_at
on public.training_registrations (user_id, updated_at desc);

create index if not exists training_audit_log_event_created_at
on public.training_audit_log (event_id, created_at desc);

alter table public.training_registrations enable row level security;
alter table public.training_audit_log enable row level security;

drop policy if exists "training_registrations_select_own_or_admin"
on public.training_registrations;
create policy "training_registrations_select_own_or_admin"
on public.training_registrations
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_admin())
);

drop policy if exists "training_audit_log_select_admin"
on public.training_audit_log;
create policy "training_audit_log_select_admin"
on public.training_audit_log
for select
to authenticated
using ((select private.is_admin()));

revoke all on public.training_registrations from anon, authenticated;
revoke all on public.training_audit_log from anon, authenticated;
grant select on public.training_registrations to authenticated;
grant select on public.training_audit_log to authenticated;

create or replace function private.prevent_capacity_below_registrations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  occupied_places integer;
begin
  if new.capacity is not distinct from old.capacity then
    return new;
  end if;

  select count(*)::integer
  into occupied_places
  from public.training_registrations as registration
  where registration.event_id = new.id
    and registration.status = 'registered';

  if new.capacity < occupied_places then
    raise exception
      'La capacité ne peut pas être inférieure aux % inscriptions confirmées',
      occupied_places;
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_capacity_below_registrations() from public;

drop trigger if exists events_capacity_guard on public.events;
create trigger events_capacity_guard
before update of capacity on public.events
for each row execute function private.prevent_capacity_below_registrations();

create or replace function public.register_for_training(p_event_id uuid)
returns public.training_registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_event public.events;
  current_registration public.training_registrations;
  confirmed_count integer;
  next_status text;
begin
  if current_user_id is null then
    raise exception 'Authentification requise';
  end if;

  select *
  into target_event
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'Session introuvable';
  end if;

  if target_event.date <= timezone('utc', now()) then
    raise exception 'Les inscriptions sont closes pour cette session';
  end if;

  if target_event.registration_closes_at is not null
    and target_event.registration_closes_at <= timezone('utc', now()) then
    raise exception 'Les inscriptions sont closes pour cette session';
  end if;

  select *
  into current_registration
  from public.training_registrations
  where event_id = p_event_id
    and user_id = current_user_id
  for update;

  if found and current_registration.status in ('registered', 'waitlisted') then
    return current_registration;
  end if;

  select count(*)::integer
  into confirmed_count
  from public.training_registrations
  where event_id = p_event_id
    and status = 'registered';

  next_status := case
    when confirmed_count < target_event.capacity then 'registered'
    else 'waitlisted'
  end;

  insert into public.training_registrations (
    event_id,
    user_id,
    status,
    attendance,
    registered_at,
    updated_at
  )
  values (
    p_event_id,
    current_user_id,
    next_status,
    'pending',
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (event_id, user_id) do update
  set
    status = excluded.status,
    attendance = 'pending',
    registered_at = excluded.registered_at,
    updated_at = excluded.updated_at
  returning * into current_registration;

  insert into public.training_audit_log (
    event_id,
    registration_id,
    actor_id,
    action,
    details
  )
  values (
    p_event_id,
    current_registration.id,
    current_user_id,
    case
      when next_status = 'registered' then 'registration.registered'
      else 'registration.waitlisted'
    end,
    jsonb_build_object('status', next_status)
  );

  return current_registration;
end;
$$;

create or replace function public.cancel_training_registration(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_event public.events;
  current_registration public.training_registrations;
  promoted_registration public.training_registrations;
begin
  if current_user_id is null then
    raise exception 'Authentification requise';
  end if;

  select *
  into target_event
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'Session introuvable';
  end if;

  select *
  into current_registration
  from public.training_registrations
  where event_id = p_event_id
    and user_id = current_user_id
  for update;

  if not found or current_registration.status = 'cancelled' then
    raise exception 'Aucune inscription active pour cette session';
  end if;

  update public.training_registrations
  set
    status = 'cancelled',
    attendance = 'pending',
    updated_at = timezone('utc', now())
  where id = current_registration.id;

  insert into public.training_audit_log (
    event_id,
    registration_id,
    actor_id,
    action,
    details
  )
  values (
    p_event_id,
    current_registration.id,
    current_user_id,
    'registration.cancelled',
    jsonb_build_object('previous_status', current_registration.status)
  );

  if current_registration.status = 'registered' then
    select *
    into promoted_registration
    from public.training_registrations
    where event_id = p_event_id
      and status = 'waitlisted'
    order by registered_at, id
    limit 1
    for update;

    if found then
      update public.training_registrations
      set
        status = 'registered',
        updated_at = timezone('utc', now())
      where id = promoted_registration.id;

      insert into public.training_audit_log (
        event_id,
        registration_id,
        actor_id,
        action,
        details
      )
      values (
        p_event_id,
        promoted_registration.id,
        current_user_id,
        'registration.promoted',
        jsonb_build_object('reason', 'place_released')
      );
    end if;
  end if;
end;
$$;

create or replace function public.set_training_attendance(
  p_registration_id uuid,
  p_attendance text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_registration public.training_registrations;
begin
  if current_user_id is null then
    raise exception 'Authentification requise';
  end if;

  if not (select private.is_admin()) then
    raise exception 'Action réservée aux responsables';
  end if;

  if p_attendance not in ('pending', 'present', 'absent') then
    raise exception 'Statut de présence invalide';
  end if;

  select *
  into target_registration
  from public.training_registrations
  where id = p_registration_id
  for update;

  if not found then
    raise exception 'Inscription introuvable';
  end if;

  if target_registration.status <> 'registered' then
    raise exception 'La présence ne peut être validée que pour une inscription confirmée';
  end if;

  update public.training_registrations
  set
    attendance = p_attendance,
    updated_at = timezone('utc', now())
  where id = p_registration_id;

  insert into public.training_audit_log (
    event_id,
    registration_id,
    actor_id,
    action,
    details
  )
  values (
    target_registration.event_id,
    target_registration.id,
    current_user_id,
    'attendance.updated',
    jsonb_build_object(
      'previous_attendance', target_registration.attendance,
      'attendance', p_attendance
    )
  );
end;
$$;

create or replace function public.set_training_capacity(
  p_event_id uuid,
  p_capacity integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_event public.events;
begin
  if current_user_id is null then
    raise exception 'Authentification requise';
  end if;

  if not (select private.is_admin()) then
    raise exception 'Action réservée aux responsables';
  end if;

  if p_capacity < 1 or p_capacity > 500 then
    raise exception 'La capacité doit être comprise entre 1 et 500';
  end if;

  select *
  into target_event
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'Session introuvable';
  end if;

  update public.events
  set capacity = p_capacity
  where id = p_event_id;

  insert into public.training_audit_log (
    event_id,
    actor_id,
    action,
    details
  )
  values (
    p_event_id,
    current_user_id,
    'capacity.updated',
    jsonb_build_object(
      'previous_capacity', target_event.capacity,
      'capacity', p_capacity
    )
  );
end;
$$;

create or replace function public.get_training_session_summaries(
  p_event_id uuid default null
)
returns table (
  event_id uuid,
  capacity integer,
  registered_count integer,
  waitlisted_count integer,
  my_status text,
  my_attendance text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentification requise';
  end if;

  return query
  select
    event.id,
    event.capacity,
    count(registration.id) filter (
      where registration.status = 'registered'
    )::integer,
    count(registration.id) filter (
      where registration.status = 'waitlisted'
    )::integer,
    max(registration.status) filter (
      where registration.user_id = current_user_id
        and registration.status <> 'cancelled'
    ),
    max(registration.attendance) filter (
      where registration.user_id = current_user_id
        and registration.status = 'registered'
    )
  from public.events as event
  left join public.training_registrations as registration
    on registration.event_id = event.id
  where p_event_id is null or event.id = p_event_id
  group by event.id, event.capacity
  order by event.id;
end;
$$;

create or replace function public.get_training_session_participants(p_event_id uuid)
returns table (
  registration_id uuid,
  user_id uuid,
  display_name text,
  email text,
  phone text,
  status text,
  attendance text,
  registered_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentification requise';
  end if;

  if not (select private.is_admin()) then
    raise exception 'Action réservée aux responsables';
  end if;

  return query
  select
    registration.id,
    registration.user_id,
    profile.display_name,
    profile.email,
    profile.phone,
    registration.status,
    registration.attendance,
    registration.registered_at
  from public.training_registrations as registration
  join public.profiles as profile
    on profile.id = registration.user_id
  where registration.event_id = p_event_id
    and registration.status <> 'cancelled'
  order by
    case registration.status
      when 'registered' then 0
      else 1
    end,
    registration.registered_at,
    registration.id;
end;
$$;

revoke all on function public.register_for_training(uuid) from public, anon;
revoke all on function public.cancel_training_registration(uuid) from public, anon;
revoke all on function public.set_training_attendance(uuid, text) from public, anon;
revoke all on function public.set_training_capacity(uuid, integer) from public, anon;
revoke all on function public.get_training_session_summaries(uuid) from public, anon;
revoke all on function public.get_training_session_participants(uuid) from public, anon;

grant execute on function public.register_for_training(uuid) to authenticated;
grant execute on function public.cancel_training_registration(uuid) to authenticated;
grant execute on function public.set_training_attendance(uuid, text) to authenticated;
grant execute on function public.set_training_capacity(uuid, integer) to authenticated;
grant execute on function public.get_training_session_summaries(uuid) to authenticated;
grant execute on function public.get_training_session_participants(uuid) to authenticated;
