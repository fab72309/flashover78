-- Inclusive finalizer quotas: the newly uploaded object is already counted.
-- Replace functions only; keep ACLs, session checks and legacy-blocking triggers.
begin;


create or replace function public.register_form_pdf_approval(
  p_bucket_id text,
  p_storage_path text,
  p_user_id uuid,
  p_file_size bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  object_metadata jsonb;
  path_parts text[];
  existing_bytes bigint;
  existing_objects bigint;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Opération réservée au finaliseur de PDF';
  end if;

  if p_bucket_id not in ('main-courantes', 'equipment-repair-requests')
     or p_user_id is null
     or p_storage_path is null
     or length(p_storage_path) > 500
     or p_file_size not between 1 and 5242880 then
    raise exception 'Objet PDF invalide';
  end if;

  path_parts := storage.foldername(p_storage_path);
  if cardinality(path_parts) <> 2
     or path_parts[1] <> p_user_id::text
     or path_parts[1] !~ '^[0-9a-fA-F-]{36}$'
     or path_parts[2] !~ '^[0-9a-fA-F-]{36}$'
     or storage.filename(p_storage_path) !~* '^[A-Za-z0-9._-]+\.pdf$' then
    raise exception 'Chemin PDF invalide';
  end if;

  select object.metadata
  into object_metadata
  from storage.objects as object
  where object.bucket_id = p_bucket_id
    and object.name = p_storage_path;

  if not found
     or coalesce(object_metadata ->> 'mimetype', '') <> 'application/pdf'
     or coalesce(object_metadata ->> 'size', '') !~ '^[0-9]+$'
     or length(coalesce(object_metadata ->> 'size', '')) > 18
     or (case
           when coalesce(object_metadata ->> 'size', '') ~ '^[0-9]+$'
             and length(coalesce(object_metadata ->> 'size', '')) <= 18
             then (object_metadata ->> 'size')::bigint
           else -1
         end <> p_file_size) then
    raise exception 'Le PDF téléversé est introuvable ou incohérent';
  end if;

  -- Service-role uploads normally have no end-user owner_id. The approval
  -- row, exact path and subsequent owner trigger provide the binding; the
  -- service-role caller is already the trusted finalizer.

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

  select
    coalesce(sum(
      case
        when object.metadata ->> 'size' ~ '^[0-9]+$'
          and length(object.metadata ->> 'size') <= 18
          then (object.metadata ->> 'size')::bigint
        else 0
      end
    ), 0),
    count(*)
  into existing_bytes, existing_objects
  from storage.objects as object
  where (storage.foldername(object.name))[1] = p_user_id::text
    and object.bucket_id in ('main-courantes', 'equipment-repair-requests');

  -- The just-uploaded object is already present in Storage, so the boundary
  -- is inclusive: 50 objects is the maximum, not 51.
  if existing_objects > 50 or existing_bytes > 104857600 then
    raise exception 'Quota PDF atteint';
  end if;

  delete from private.form_pdf_upload_approvals
  where expires_at < timezone('utc', now());

  insert into private.form_pdf_upload_approvals (
    bucket_id,
    storage_path,
    user_id,
    file_size,
    created_at,
    expires_at,
    consumed_at
  )
  values (
    p_bucket_id,
    p_storage_path,
    p_user_id,
    p_file_size,
    timezone('utc', now()),
    timezone('utc', now()) + interval '15 minutes',
    null
  )
  on conflict (bucket_id, storage_path) do update
  set user_id = excluded.user_id,
      file_size = excluded.file_size,
      created_at = excluded.created_at,
      expires_at = excluded.expires_at,
      consumed_at = null;

  return true;
end;
$$;

create or replace function public.register_document_upload_approval(
  p_bucket_id text,
  p_storage_path text,
  p_user_id uuid,
  p_file_size bigint,
  p_mime_type text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  object_metadata jsonb;
  object_size_text text;
  object_size bigint;
  existing_bytes bigint;
  existing_objects bigint;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Opération réservée au finaliseur documentaire';
  end if;

  if p_bucket_id not in (
       'sdis78-documents',
       'lectures-documents',
       'brulage-documents',
       'resources'
     )
     or p_user_id is null
     or p_storage_path is null
     or length(p_storage_path) > 500
     or p_storage_path like '%..%'
     or split_part(p_storage_path, '/', 1) <> p_user_id::text
     or lower(p_storage_path) !~ '\.(pdf|odt|doc|docx|ppt|pptx|txt)$'
     or p_file_size not between 1 and 20971520
     or p_mime_type not in (
       'application/pdf',
       'application/vnd.oasis.opendocument.text',
       'application/msword',
       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
       'application/vnd.ms-powerpoint',
       'application/vnd.openxmlformats-officedocument.presentationml.presentation',
       'text/plain'
     ) then
    raise exception 'Document invalide';
  end if;

  if (lower(p_storage_path) ~ '\.pdf$' and p_mime_type <> 'application/pdf')
     or (lower(p_storage_path) ~ '\.odt$' and p_mime_type <> 'application/vnd.oasis.opendocument.text')
     or (lower(p_storage_path) ~ '\.doc$' and p_mime_type <> 'application/msword')
     or (lower(p_storage_path) ~ '\.docx$' and p_mime_type <> 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
     or (lower(p_storage_path) ~ '\.ppt$' and p_mime_type <> 'application/vnd.ms-powerpoint')
     or (lower(p_storage_path) ~ '\.pptx$' and p_mime_type <> 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
     or (lower(p_storage_path) ~ '\.txt$' and p_mime_type <> 'text/plain') then
    raise exception 'Type MIME incohérent';
  end if;

  select object.metadata
  into object_metadata
  from storage.objects as object
  where object.bucket_id = p_bucket_id
    and object.name = p_storage_path;

  if not found then
    raise exception 'Document téléversé introuvable';
  end if;

  object_size_text := nullif(object_metadata ->> 'size', '');
  object_size := case
    when object_size_text ~ '^[0-9]+$' and length(object_size_text) <= 18
      then object_size_text::bigint
    else -1
  end;
  if object_size <> p_file_size
     or coalesce(object_metadata ->> 'mimetype', '') <> p_mime_type then
    raise exception 'Métadonnées Storage incohérentes';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

  select
    coalesce(sum(
      case
        when object.metadata ->> 'size' ~ '^[0-9]+$'
          and length(object.metadata ->> 'size') <= 18
          then (object.metadata ->> 'size')::bigint
        else 0
      end
    ), 0),
    count(*)
  into existing_bytes, existing_objects
  from storage.objects as object
  where (storage.foldername(object.name))[1] = p_user_id::text
    and object.bucket_id in (
      'sdis78-documents',
      'lectures-documents',
      'brulage-documents',
      'resources'
    );

  -- The just-uploaded object is already present in Storage, so the boundary
  -- is inclusive: 200 objects is the maximum, not 201.
  if existing_objects > 200 or existing_bytes > 104857600 then
    raise exception 'Quota documentaire atteint';
  end if;

  delete from private.document_upload_approvals
  where expires_at < timezone('utc', now());

  insert into private.document_upload_approvals (
    bucket_id,
    storage_path,
    user_id,
    file_size,
    mime_type,
    created_at,
    expires_at,
    consumed_at
  )
  values (
    p_bucket_id,
    p_storage_path,
    p_user_id,
    p_file_size,
    p_mime_type,
    timezone('utc', now()),
    timezone('utc', now()) + interval '15 minutes',
    null
  )
  on conflict (bucket_id, storage_path) do update
  set user_id = excluded.user_id,
      file_size = excluded.file_size,
      mime_type = excluded.mime_type,
      created_at = excluded.created_at,
      expires_at = excluded.expires_at,
      consumed_at = null;

  return true;
end;
$$;

revoke all on function public.register_form_pdf_approval(text, text, uuid, bigint)
  from public, anon, authenticated;
grant execute on function public.register_form_pdf_approval(text, text, uuid, bigint)
  to service_role;
revoke all on function public.register_document_upload_approval(text, text, uuid, bigint, text)
  from public, anon, authenticated;
grant execute on function public.register_document_upload_approval(text, text, uuid, bigint, text)
  to service_role;

commit;
