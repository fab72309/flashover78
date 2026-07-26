create or replace function public.cancel_training_registration(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_registration public.training_registrations;
  promoted_registration public.training_registrations;
begin
  if current_user_id is null then
    raise exception 'Authentification requise';
  end if;

  perform 1
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

revoke all on function public.cancel_training_registration(uuid) from public, anon;
grant execute on function public.cancel_training_registration(uuid) to authenticated;
