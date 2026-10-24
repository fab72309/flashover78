-- Calendar entries remain readable by members, while all planning mutations
-- are reserved to contributors and administrators.  The historical training
-- registration RPCs are kept for internal reporting, but direct API calls by
-- a member must not create or cancel a registration.
do $$
declare
  target record;
  definition text;
  guarded_definition text;
  contributor_guard text := 'if current_user_id is null or not private.has_active_session() then'
    || chr(10) || '    raise exception ''Authentification requise'';'
    || chr(10) || '  end if;' || chr(10) || chr(10)
    || '  if not (select private.has_role(''contributor'')) then'
    || chr(10) || '    raise exception ''Action réservée aux contributeurs et administrateurs'';'
    || chr(10) || '  end if;';
  capacity_guard text := 'if not (select private.has_role(''contributor'')) then'
    || chr(10) || '    raise exception ''Action réservée aux contributeurs et administrateurs'';'
    || chr(10) || '  end if;';
begin
  for target in
    select * from (values
      ('public.register_for_training(uuid)'),
      ('public.cancel_training_registration(uuid)')
    ) as entries(signature)
  loop
    select pg_get_functiondef(target.signature::regprocedure)
    into definition;

    if definition is null then
      raise exception 'RPC de planning attendue absente: %', target.signature;
    end if;

    if position('private.has_role(''contributor'')' in definition) > 0 then
      continue;
    end if;

    guarded_definition := regexp_replace(
      definition,
      'if current_user_id is null or not private[.]has_active_session[(][)] then[[:space:]]+'
        || 'raise exception ''Authentification requise'';[[:space:]]+end if;',
      contributor_guard,
      1,
      1,
      'n'
    );
    if guarded_definition = definition then
      raise exception 'Garde d’authentification inattendue pour %', target.signature;
    end if;
    execute guarded_definition;
  end loop;

  select pg_get_functiondef(
    'public.set_training_capacity(uuid,integer)'::regprocedure
  ) into definition;

  if definition is null then
    raise exception 'RPC de capacité attendue absente';
  end if;

  if position('private.has_role(''contributor'')' in definition) = 0 then
    guarded_definition := regexp_replace(
      definition,
      'if not [(]select private[.]is_admin[(][)][)] then[[:space:]]+'
        || 'raise exception ''Action réservée aux responsables'';[[:space:]]+end if;',
      capacity_guard,
      1,
      1,
      'n'
    );
    if guarded_definition = definition then
      raise exception 'Garde de capacité inattendue';
    end if;
    execute guarded_definition;
  end if;
end;
$$;
