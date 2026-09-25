-- Form PDFs must pass through a server-side byte check before a business row
-- can reference them. Direct authenticated Storage inserts are removed for
-- these two buckets; the finalizer Edge Function uploads with service_role,
-- then registers a short-lived approval consumed by the row trigger.

create table if not exists private.form_pdf_upload_approvals (
  bucket_id text not null,
  storage_path text not null,
  user_id uuid not null,
  file_size bigint not null check (file_size between 1 and 5242880),
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default timezone('utc', now()) + interval '15 minutes',
  consumed_at timestamptz,
  primary key (bucket_id, storage_path)
);

create index if not exists form_pdf_upload_approvals_expiry_idx
on private.form_pdf_upload_approvals (expires_at)
where consumed_at is null;

revoke all on table private.form_pdf_upload_approvals from public, anon, authenticated;
grant select, insert, update, delete on table private.form_pdf_upload_approvals to service_role;

-- Supabase's storage.foldername() returns only folders, not the filename.
-- Re-state the legacy quota helper with the real two-folder layout before the
-- direct insert policies are removed below; this also keeps replayed fixtures
-- and any administrative callers fail-closed.
create or replace function private.pdf_storage_upload_allowed(
  p_bucket_id text,
  p_storage_path text,
  p_metadata jsonb
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  path_parts text[];
  size_text text := nullif(p_metadata ->> 'size', '');
  size_bytes bigint;
  existing_bytes bigint;
  existing_objects bigint;
begin
  if current_user_id is null
     or not private.has_active_session()
     or p_bucket_id not in ('main-courantes', 'equipment-repair-requests')
     or p_storage_path is null
     or length(p_storage_path) > 500
     or p_metadata is null
     or (p_metadata ->> 'mimetype') <> 'application/pdf'
     or size_text is null
     or size_text !~ '^[0-9]+$'
     or length(size_text) > 18 then
    return false;
  end if;

  path_parts := storage.foldername(p_storage_path);
  if cardinality(path_parts) <> 2
     or path_parts[1] <> current_user_id::text
     or path_parts[1] !~ '^[0-9a-fA-F-]{36}$'
     or path_parts[2] !~ '^[0-9a-fA-F-]{36}$'
     or storage.filename(p_storage_path) !~* '^[A-Za-z0-9._-]+\.pdf$' then
    return false;
  end if;

  begin
    size_bytes := size_text::bigint;
  exception when invalid_text_representation or numeric_value_out_of_range then
    return false;
  end;
  if size_bytes < 1 or size_bytes > 5242880 then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 0)
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
  where (storage.foldername(object.name))[1] = current_user_id::text
    and object.bucket_id in ('main-courantes', 'equipment-repair-requests');

  return existing_objects < 50
    and existing_bytes + size_bytes <= 104857600;
end;
$$;

revoke all on function private.pdf_storage_upload_allowed(text, text, jsonb)
from public, anon;
grant execute on function private.pdf_storage_upload_allowed(text, text, jsonb)
to authenticated;

create or replace function public.require_active_session()
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.has_active_session()) then
    raise exception 'Authentification requise';
  end if;
  return true;
end;
$$;

revoke all on function public.require_active_session() from public, anon;
grant execute on function public.require_active_session() to authenticated;

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
  if existing_objects >= 50 or existing_bytes > 104857600 then
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

revoke all on function public.register_form_pdf_approval(text, text, uuid, bigint)
from public, anon, authenticated;
grant execute on function public.register_form_pdf_approval(text, text, uuid, bigint)
to service_role;

create or replace function public.enqueue_storage_cleanup_service_role(
  p_bucket_id text,
  p_storage_path text,
  p_requested_by uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Opération réservée au worker de nettoyage';
  end if;

  if p_bucket_id not in (
      'sdis78-documents',
      'lectures-documents',
      'brulage-documents',
      'resources',
      'main-courantes',
      'equipment-repair-requests'
    )
    or p_storage_path is null
    or length(p_storage_path) > 500
    or p_storage_path like '%..%' then
    raise exception 'Objet de stockage invalide';
  end if;

  insert into private.storage_cleanup_queue (bucket_id, storage_path, requested_by)
  values (p_bucket_id, p_storage_path, p_requested_by)
  on conflict (bucket_id, storage_path) do update
  set requested_by = excluded.requested_by,
      attempt_count = 0,
      next_attempt_at = timezone('utc', now()),
      last_error = null,
      completed_at = null;

  return true;
end;
$$;

revoke all on function public.enqueue_storage_cleanup_service_role(text, text, uuid)
from public, anon, authenticated;
grant execute on function public.enqueue_storage_cleanup_service_role(text, text, uuid)
to service_role;

-- The old owner_id path remains accepted for historical objects. New service
-- role uploads must have a matching, unexpired approval and are consumed only
-- by the first business-row insert that references the exact object.
create or replace function private.enforce_form_pdf_storage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_bucket text;
  object_metadata jsonb;
  object_owner_id text;
  approved_user_id uuid;
  approved_file_size bigint;
  approved boolean := false;
  affected integer;
begin
  expected_bucket := case
    when tg_table_name = 'main_courantes' then 'main-courantes'
    when tg_table_name = 'equipment_repair_requests' then 'equipment-repair-requests'
    else null
  end;

  if expected_bucket is null then
    raise exception 'Table de formulaire PDF inattendue';
  end if;

  select object.metadata, object.owner_id
  into object_metadata, object_owner_id
  from storage.objects as object
  where object.bucket_id = expected_bucket
    and object.name = new.pdf_storage_path;

  if not found
     or coalesce(object_metadata ->> 'mimetype', '') <> 'application/pdf'
     or (object_metadata ->> 'size') is null
     or (object_metadata ->> 'size') !~ '^[0-9]+$'
     or length(object_metadata ->> 'size') > 18
     or (case
           when (object_metadata ->> 'size') ~ '^[0-9]+$'
             and length(object_metadata ->> 'size') <= 18
             then (object_metadata ->> 'size')::bigint
           else -1
         end <> new.pdf_file_size)
     or new.pdf_file_size not between 1 and 5242880 then
    raise exception 'Le PDF doit exister dans Storage et correspondre à sa taille déclarée';
  end if;

  if object_owner_id is distinct from new.user_id::text then
    select approval.user_id, approval.file_size
    into approved_user_id, approved_file_size
    from private.form_pdf_upload_approvals as approval
    where approval.bucket_id = expected_bucket
      and approval.storage_path = new.pdf_storage_path
      and approval.user_id = new.user_id
      and approval.file_size = new.pdf_file_size
      and approval.consumed_at is null
      and approval.expires_at >= timezone('utc', now())
    for update;

    approved := found;
    if not approved then
      raise exception 'Le PDF doit être finalisé par le serveur avant son enregistrement';
    end if;
  end if;

  if approved then
    update private.form_pdf_upload_approvals
    set consumed_at = timezone('utc', now())
    where bucket_id = expected_bucket
      and storage_path = new.pdf_storage_path
      and user_id = approved_user_id
      and file_size = approved_file_size
      and consumed_at is null;
    get diagnostics affected = row_count;
    if affected <> 1 then
      raise exception 'Le PDF a déjà été référencé';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_form_pdf_storage() from public, anon;

-- No authenticated caller can upload arbitrary bytes to a form bucket. The
-- finalizer Edge Function is the only writer; service_role bypasses RLS.
drop policy if exists "main_courantes_storage_insert_own" on storage.objects;
drop policy if exists "equipment_repair_requests_storage_insert_own" on storage.objects;
