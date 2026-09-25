-- The catalogue roadmap and frontend grant contributors the ability to
-- publish documents and add immutable versions. Keep metadata administration
-- privileged, but align the two publication RPCs with the cumulative role
-- model without rewriting an already-applied migration.
do $$
declare
  target record;
  definition text;
  contributor_definition text;
begin
  for target in
    select * from (values
      (
        'public.create_document(text,text,text[],text,text,date,date,text,text,text,text,bigint)',
        'if not (select private.is_admin()) then',
        'if not (select private.has_role(''contributor'')) then'
      ),
      (
        'public.register_document_version(uuid,text,text,date,date,text,text,text,text,bigint)',
        'if not (select private.is_admin()) then',
        'if not (select private.has_role(''contributor'')) then'
      )
    ) as entries(signature, admin_guard, contributor_guard)
  loop
    select pg_get_functiondef(target.signature::regprocedure)
    into definition;

    if definition is null then
      raise exception 'RPC documentaire attendue absente pendant le durcissement: %', target.signature;
    end if;

    if position(target.contributor_guard in definition) > 0 then
      continue;
    end if;

    if position(target.admin_guard in definition) = 0 then
      raise exception 'Garde documentaire inattendue pour %', target.signature;
    end if;

    contributor_definition := replace(
      definition,
      target.admin_guard,
      target.contributor_guard
    );
    execute contributor_definition;
  end loop;
end;
$$;
