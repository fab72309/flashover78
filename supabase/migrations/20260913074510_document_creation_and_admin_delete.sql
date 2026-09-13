-- The legacy migration created a second overload with the same named
-- arguments as the current create_document function, but in a different
-- positional order. PostgREST can therefore fail to resolve the RPC call.
drop function if exists public.create_document(
  text,
  text,
  text,
  text,
  text,
  text,
  bigint,
  text,
  text,
  text[],
  date,
  date
);

create or replace function public.delete_document(
  p_resource_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_title text;
  target_category text;
  target_version_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentification requise';
  end if;

  if not (select private.has_role('admin')) then
    raise exception 'Action réservée aux administrateurs';
  end if;

  select title, category
  into target_title, target_category
  from public.resources
  where id = p_resource_id;

  if not found then
    raise exception 'Document introuvable';
  end if;

  select count(*)::integer
  into target_version_count
  from public.resource_versions
  where resource_id = p_resource_id;

  insert into public.document_audit_log (
    resource_id,
    actor_id,
    action,
    details
  )
  values (
    p_resource_id,
    current_user_id,
    'document.deleted',
    jsonb_build_object(
      'resource_id', p_resource_id,
      'title', target_title,
      'category', target_category,
      'version_count', target_version_count
    )
  );

  delete from public.resources
  where id = p_resource_id;
end;
$$;

revoke all on function public.delete_document(uuid) from public, anon;
grant execute on function public.delete_document(uuid) to authenticated;
