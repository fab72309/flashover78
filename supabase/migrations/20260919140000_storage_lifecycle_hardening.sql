-- Bound form-PDF orphan uploads and make Storage cleanup retryable. No object
-- is deleted by this migration; a service-role worker must process the queue
-- after a read-only inventory and deployment approval.

create table if not exists private.storage_cleanup_queue (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  storage_path text not null,
  requested_by uuid,
  attempt_count integer not null default 0 check (attempt_count between 0 and 100),
  next_attempt_at timestamptz not null default timezone('utc', now()),
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  unique (bucket_id, storage_path)
);

create index if not exists storage_cleanup_queue_pending_idx
on private.storage_cleanup_queue (next_attempt_at, created_at)
where completed_at is null;

revoke all on table private.storage_cleanup_queue from public, anon, authenticated;
grant select, insert, update on private.storage_cleanup_queue to service_role;

create or replace function public.enqueue_storage_cleanup(
  p_bucket_id text,
  p_storage_path text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  is_privileged boolean;
begin
  if current_user_id is null or not private.has_active_session() then
    raise exception 'Authentification requise';
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
    or p_storage_path like '%..%'
  then
    raise exception 'Objet de stockage invalide';
  end if;

  is_privileged := (select private.is_admin());
  if not is_privileged and (storage.foldername(p_storage_path))[1] <> current_user_id::text then
    raise exception 'Objet de stockage non autorisé';
  end if;

  insert into private.storage_cleanup_queue (bucket_id, storage_path, requested_by)
  values (p_bucket_id, p_storage_path, current_user_id)
  on conflict (bucket_id, storage_path) do update
  set
    requested_by = excluded.requested_by,
    attempt_count = 0,
    next_attempt_at = timezone('utc', now()),
    last_error = null,
    completed_at = null;
end;
$$;

revoke all on function public.enqueue_storage_cleanup(text, text) from public, anon;
grant execute on function public.enqueue_storage_cleanup(text, text) to authenticated;

-- Form PDFs use the same per-owner byte/object budget as the catalogue. The
-- limit is deliberately generous enough for normal history while bounding an
-- authorized account that uploads without ever creating a business record.
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
  if cardinality(path_parts) <> 3
     or path_parts[1] <> current_user_id::text
     or path_parts[1] !~ '^[0-9a-fA-F-]{36}$'
     or path_parts[2] !~ '^[0-9a-fA-F-]{36}$'
     or path_parts[3] !~* '^[A-Za-z0-9._-]+\.pdf$' then
    return false;
  end if;

  size_bytes := size_text::bigint;
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
  where object.owner_id = current_user_id::text
    and object.bucket_id in ('main-courantes', 'equipment-repair-requests');

  return existing_objects < 50
    and existing_bytes + size_bytes <= 104857600;
end;
$$;

revoke all on function private.pdf_storage_upload_allowed(text, text, jsonb)
from public, anon;
grant execute on function private.pdf_storage_upload_allowed(text, text, jsonb) to authenticated;

create or replace function private.enforce_form_pdf_storage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_bucket text;
  object_metadata jsonb;
begin
  expected_bucket := case
    when tg_table_name = 'main_courantes' then 'main-courantes'
    when tg_table_name = 'equipment_repair_requests' then 'equipment-repair-requests'
    else null
  end;

  if expected_bucket is null then
    raise exception 'Table de formulaire PDF inattendue';
  end if;

  select object.metadata
  into object_metadata
  from storage.objects as object
  where object.bucket_id = expected_bucket
    and object.name = new.pdf_storage_path
    and object.owner_id = new.user_id::text;

  if not found
     or coalesce(object_metadata ->> 'mimetype', '') <> 'application/pdf'
     or (object_metadata ->> 'size') is null
     or (object_metadata ->> 'size') !~ '^[0-9]+$'
     or length(object_metadata ->> 'size') > 18
     or (object_metadata ->> 'size')::bigint <> new.pdf_file_size
     or new.pdf_file_size not between 1 and 5242880 then
    raise exception 'Le PDF doit exister dans Storage et correspondre à sa taille déclarée';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_form_pdf_storage() from public, anon;

drop trigger if exists main_courantes_validate_storage on public.main_courantes;
create trigger main_courantes_validate_storage
before insert or update of user_id, pdf_storage_path, pdf_file_size
on public.main_courantes
for each row execute function private.enforce_form_pdf_storage();

drop trigger if exists equipment_repair_requests_validate_storage on public.equipment_repair_requests;
create trigger equipment_repair_requests_validate_storage
before insert or update of user_id, pdf_storage_path, pdf_file_size
on public.equipment_repair_requests
for each row execute function private.enforce_form_pdf_storage();

-- Every DB deletion records the object before the client attempts a best-effort
-- remove. This also covers account cascades and failed browser cleanup.
create or replace function private.queue_deleted_storage_object()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_bucket text;
  deleted_path text;
begin
  if tg_table_name = 'resources' then
    deleted_bucket := old.bucket_id;
    deleted_path := old.current_storage_path;
  elsif tg_table_name = 'resource_versions' then
    deleted_bucket := old.bucket_id;
    deleted_path := old.storage_path;
  elsif tg_table_name = 'main_courantes' then
    deleted_bucket := 'main-courantes';
    deleted_path := old.pdf_storage_path;
  elsif tg_table_name = 'equipment_repair_requests' then
    deleted_bucket := 'equipment-repair-requests';
    deleted_path := old.pdf_storage_path;
  end if;

  if deleted_bucket is not null and deleted_path is not null then
    insert into private.storage_cleanup_queue (bucket_id, storage_path)
    values (deleted_bucket, deleted_path)
    on conflict (bucket_id, storage_path) do update
    set completed_at = null,
        attempt_count = 0,
        next_attempt_at = timezone('utc', now()),
        last_error = null;
  end if;

  return old;
end;
$$;

revoke all on function private.queue_deleted_storage_object() from public, anon;

drop trigger if exists resources_queue_storage_cleanup on public.resources;
create trigger resources_queue_storage_cleanup
after delete on public.resources
for each row execute function private.queue_deleted_storage_object();

drop trigger if exists resource_versions_queue_storage_cleanup on public.resource_versions;
create trigger resource_versions_queue_storage_cleanup
after delete on public.resource_versions
for each row execute function private.queue_deleted_storage_object();

drop trigger if exists main_courantes_queue_storage_cleanup on public.main_courantes;
create trigger main_courantes_queue_storage_cleanup
after delete on public.main_courantes
for each row execute function private.queue_deleted_storage_object();

drop trigger if exists equipment_repair_requests_queue_storage_cleanup on public.equipment_repair_requests;
create trigger equipment_repair_requests_queue_storage_cleanup
after delete on public.equipment_repair_requests
for each row execute function private.queue_deleted_storage_object();
