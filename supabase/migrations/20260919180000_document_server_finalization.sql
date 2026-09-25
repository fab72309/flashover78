-- Catalog documents must pass through a server-side byte check before a
-- resource version can reference them. Direct authenticated Storage inserts
-- are removed below; the Edge finalizer uploads with service_role and records
-- a short-lived, one-time approval consumed by the version trigger.

create table if not exists private.document_upload_approvals (
  bucket_id text not null,
  storage_path text not null,
  user_id uuid not null,
  file_size bigint not null check (file_size between 1 and 20971520),
  mime_type text not null,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default timezone('utc', now()) + interval '15 minutes',
  consumed_at timestamptz,
  primary key (bucket_id, storage_path)
);

create index if not exists document_upload_approvals_expiry_idx
on private.document_upload_approvals (expires_at)
where consumed_at is null;

revoke all on table private.document_upload_approvals from public, anon, authenticated;
grant select, insert, update, delete on private.document_upload_approvals to service_role;

create or replace function public.require_contributor_session()
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or not (select private.has_active_session())
     or not (select private.has_role('contributor')) then
    raise exception 'Droits insuffisants';
  end if;
  return true;
end;
$$;

revoke all on function public.require_contributor_session() from public, anon;
grant execute on function public.require_contributor_session() to authenticated;

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
  if existing_objects >= 200 or existing_bytes > 104857600 then
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

revoke all on function public.register_document_upload_approval(text, text, uuid, bigint, text)
from public, anon, authenticated;
grant execute on function public.register_document_upload_approval(text, text, uuid, bigint, text)
to service_role;

create or replace function private.enforce_resource_version_storage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  object_metadata jsonb;
  object_owner_id text;
  object_size_text text;
  object_size bigint;
  approved_user_id uuid;
  approved_file_size bigint;
  approved_mime_type text;
  approved boolean := false;
  affected integer;
begin
  if new.uploaded_by is null
     or split_part(new.storage_path, '/', 1) <> new.uploaded_by::text then
    raise exception 'Le chemin documentaire doit appartenir au téléverseur';
  end if;

  select object.metadata, object.owner_id
  into object_metadata, object_owner_id
  from storage.objects as object
  where object.bucket_id = new.bucket_id
    and object.name = new.storage_path;

  if not found then
    raise exception 'Le fichier documentaire doit exister dans Storage';
  end if;

  object_size_text := nullif(object_metadata ->> 'size', '');
  object_size := case
    when object_size_text ~ '^[0-9]+$' and length(object_size_text) <= 18
      then object_size_text::bigint
    else -1
  end;
  if object_size <> new.file_size then
    raise exception 'La taille déclarée du document ne correspond pas à Storage';
  end if;

  if coalesce(object_metadata ->> 'mimetype', '') <> coalesce(new.mime_type, '') then
    raise exception 'Le type MIME déclaré du document ne correspond pas à Storage';
  end if;

  if (lower(new.storage_path) ~ '\.pdf$' and new.mime_type <> 'application/pdf')
     or (lower(new.storage_path) ~ '\.odt$' and new.mime_type <> 'application/vnd.oasis.opendocument.text')
     or (lower(new.storage_path) ~ '\.doc$' and new.mime_type <> 'application/msword')
     or (lower(new.storage_path) ~ '\.docx$' and new.mime_type <> 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
     or (lower(new.storage_path) ~ '\.ppt$' and new.mime_type <> 'application/vnd.ms-powerpoint')
     or (lower(new.storage_path) ~ '\.pptx$' and new.mime_type <> 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
     or (lower(new.storage_path) ~ '\.txt$' and new.mime_type <> 'text/plain') then
    raise exception 'Le type MIME ne correspond pas à l’extension du document';
  end if;

  if object_owner_id is distinct from new.uploaded_by::text then
    select approval.user_id, approval.file_size, approval.mime_type
    into approved_user_id, approved_file_size, approved_mime_type
    from private.document_upload_approvals as approval
    where approval.bucket_id = new.bucket_id
      and approval.storage_path = new.storage_path
      and approval.user_id = new.uploaded_by
      and approval.file_size = new.file_size
      and approval.mime_type = new.mime_type
      and approval.consumed_at is null
      and approval.expires_at >= timezone('utc', now())
    for update;

    approved := found;
    if not approved then
      raise exception 'Le document doit être finalisé par le serveur avant son enregistrement';
    end if;
  end if;

  if approved then
    update private.document_upload_approvals
    set consumed_at = timezone('utc', now())
    where bucket_id = new.bucket_id
      and storage_path = new.storage_path
      and user_id = approved_user_id
      and file_size = approved_file_size
      and mime_type = approved_mime_type
      and consumed_at is null;
    get diagnostics affected = row_count;
    if affected <> 1 then
      raise exception 'Le document a déjà été référencé';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_resource_version_storage() from public, anon;

-- No authenticated caller can place arbitrary bytes directly in an approved
-- catalogue bucket. The finalizer is the only writer; service_role bypasses
-- Storage RLS and the trigger approval binds the object to the user/version.
drop policy if exists "documents_insert_contributor" on storage.objects;
