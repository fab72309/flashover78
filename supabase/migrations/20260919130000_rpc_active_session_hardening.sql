-- SECURITY DEFINER RPCs do not automatically evaluate ordinary RLS policies
-- as the caller. Add the same live-session gate used by the RLS migration to
-- every user-facing RPC that relies only on auth.uid(). This is intentionally
-- additive: pg_get_functiondef preserves each already-deployed function body
-- and this migration changes only the first authentication guard.
do $$
declare
  target record;
  definition text;
  guarded_definition text;
begin
  for target in
    select * from (values
      ('public.create_carpool_request(uuid,integer,text)', 'if current_user_id is null then', 'if current_user_id is null or not private.has_active_session() then'),
      ('public.respond_to_carpool_request(uuid,text)', 'if current_user_id is null then', 'if current_user_id is null or not private.has_active_session() then'),
      ('public.cancel_carpool_request(uuid)', 'if current_user_id is null then', 'if current_user_id is null or not private.has_active_session() then'),
      ('public.cancel_carpool_trip(uuid)', 'if current_user_id is null then', 'if current_user_id is null or not private.has_active_session() then'),
      ('public.create_carpool_post(uuid,text,text,text,timestamptz,text,integer,text,text,text,text)', 'if current_user_id is null then', 'if current_user_id is null or not private.has_active_session() then'),
      ('public.request_carpool_ride(uuid,integer,text)', 'if current_user_id is null then', 'if current_user_id is null or not private.has_active_session() then'),
      ('public.create_carpool_match(uuid,uuid,integer,text)', 'if current_user_id is null then', 'if current_user_id is null or not private.has_active_session() then'),
      ('public.respond_to_carpool_match(uuid,text)', 'if current_user_id is null then', 'if current_user_id is null or not private.has_active_session() then'),
      ('public.cancel_carpool_match(uuid)', 'if current_user_id is null then', 'if current_user_id is null or not private.has_active_session() then'),
      ('public.cancel_carpool_post(uuid)', 'if current_user_id is null then', 'if current_user_id is null or not private.has_active_session() then'),
      ('public.complete_carpool_post(uuid)', 'if current_user_id is null then', 'if current_user_id is null or not private.has_active_session() then'),
      ('public.register_for_training(uuid)', 'if current_user_id is null then', 'if current_user_id is null or not private.has_active_session() then'),
      ('public.cancel_training_registration(uuid)', 'if current_user_id is null then', 'if current_user_id is null or not private.has_active_session() then'),
      ('public.get_training_session_summaries(uuid)', 'if current_user_id is null then', 'if current_user_id is null or not private.has_active_session() then'),
      ('public.search_documents(text,text,text,boolean,text,uuid)', 'if current_user_id is null then', 'if current_user_id is null or not private.has_active_session() then'),
      ('public.list_document_versions(uuid)', 'if (select auth.uid()) is null then', 'if (select auth.uid()) is null or not private.has_active_session() then'),
      ('public.toggle_document_favorite(uuid)', 'if current_user_id is null then', 'if current_user_id is null or not private.has_active_session() then'),
      ('public.set_document_offline_selected(uuid,boolean)', 'if current_user_id is null then', 'if current_user_id is null or not private.has_active_session() then')
    ) as entries(signature, old_guard, new_guard)
  loop
    select pg_get_functiondef(target.signature::regprocedure)
    into definition;

    if definition is null then
      raise exception 'RPC attendue absente pendant le durcissement de session: %', target.signature;
    end if;

    if position(target.new_guard in definition) > 0 then
      continue;
    end if;

    if position(target.old_guard in definition) = 0 then
      raise exception 'Garde d’authentification inattendue pour %', target.signature;
    end if;

    guarded_definition := replace(definition, target.old_guard, target.new_guard);
    execute guarded_definition;
  end loop;
end;
$$;
