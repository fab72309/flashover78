create or replace function public.cancel_training_registration(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_event_date timestamptz;
  current_registration public.training_registrations;
  promoted_registration public.training_registrations;
begin
  if current_user_id is null then
    raise exception 'Authentification requise';
  end if;

  select event.date
  into target_event_date
  from public.events as event
  where event.id = p_event_id
  for update;

  if not found then
    raise exception 'Session introuvable';
  end if;

  if target_event_date <= timezone('utc', now()) then
    raise exception 'Une inscription ne peut plus être annulée après le début de la session';
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
  confirmed_count integer;
  promoted_registration public.training_registrations;
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

  select count(*)::integer
  into confirmed_count
  from public.training_registrations
  where event_id = p_event_id
    and status = 'registered';

  while confirmed_count < p_capacity loop
    select *
    into promoted_registration
    from public.training_registrations
    where event_id = p_event_id
      and status = 'waitlisted'
    order by registered_at, id
    limit 1
    for update;

    exit when not found;

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
      jsonb_build_object('reason', 'capacity_increased')
    );

    confirmed_count := confirmed_count + 1;
  end loop;

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

revoke all on function public.cancel_training_registration(uuid) from public, anon;
revoke all on function public.set_training_capacity(uuid, integer) from public, anon;
grant execute on function public.cancel_training_registration(uuid) to authenticated;
grant execute on function public.set_training_capacity(uuid, integer) to authenticated;
