-- Service-role-only RPCs for the Storage cleanup worker. The worker must
-- recheck references immediately before every object deletion and record
-- failures with bounded backoff. These functions do not delete anything by
-- themselves; the Edge Function performs the Storage API operation.

create or replace function public.storage_cleanup_is_referenced(
  p_bucket_id text,
  p_storage_path text
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

  if p_bucket_id is null
     or p_bucket_id not in (
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

  return exists (
    select 1
    from public.resources as resource
    where resource.bucket_id = p_bucket_id
      and resource.current_storage_path = p_storage_path
  )
  or exists (
    select 1
    from public.resource_versions as version
    where version.bucket_id = p_bucket_id
      and version.storage_path = p_storage_path
  )
  or exists (
    select 1
    from public.main_courantes as record
    where p_bucket_id = 'main-courantes'
      and record.pdf_storage_path = p_storage_path
  )
  or exists (
    select 1
    from public.equipment_repair_requests as record
    where p_bucket_id = 'equipment-repair-requests'
      and record.pdf_storage_path = p_storage_path
  );
end;
$$;

revoke all on function public.storage_cleanup_is_referenced(text, text)
from public, anon, authenticated;
grant execute on function public.storage_cleanup_is_referenced(text, text)
to service_role;

create or replace function public.claim_storage_cleanup_batch(
  p_limit integer default 50
)
returns table (
  id uuid,
  bucket_id text,
  storage_path text,
  should_delete boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Opération réservée au worker de nettoyage';
  end if;

  return query
  with candidates as (
    select
      queue.id,
      queue.bucket_id,
      queue.storage_path,
      not public.storage_cleanup_is_referenced(queue.bucket_id, queue.storage_path)
        as should_delete
    from private.storage_cleanup_queue as queue
    where queue.completed_at is null
      and queue.next_attempt_at <= timezone('utc', now())
      and queue.attempt_count < 100
    order by queue.next_attempt_at, queue.created_at, queue.id
    for update skip locked
    limit requested_limit
  ), marked as (
    update private.storage_cleanup_queue as queue
    set
      attempt_count = queue.attempt_count + 1,
      next_attempt_at = timezone('utc', now()) + interval '10 minutes',
      last_error = null
    from candidates
    where queue.id = candidates.id
    returning queue.id, queue.bucket_id, queue.storage_path
  )
  select marked.id, marked.bucket_id, marked.storage_path, candidates.should_delete
  from marked
  join candidates on candidates.id = marked.id;
end;
$$;

revoke all on function public.claim_storage_cleanup_batch(integer)
from public, anon, authenticated;
grant execute on function public.claim_storage_cleanup_batch(integer)
to service_role;

create or replace function public.complete_storage_cleanup(
  p_id uuid,
  p_succeeded boolean,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated boolean;
  affected integer;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Opération réservée au worker de nettoyage';
  end if;

  if p_id is null then
    return false;
  end if;

  if p_succeeded then
    update private.storage_cleanup_queue
    set completed_at = timezone('utc', now()),
        last_error = null,
        next_attempt_at = timezone('utc', now())
    where id = p_id;
  else
    update private.storage_cleanup_queue
    set next_attempt_at = timezone('utc', now()) + case
          when attempt_count <= 1 then interval '5 minutes'
          when attempt_count <= 3 then interval '15 minutes'
          when attempt_count <= 6 then interval '1 hour'
          else interval '6 hours'
        end,
        last_error = left(coalesce(p_error, 'Échec Storage non détaillé'), 1000)
    where id = p_id
      and completed_at is null;
  end if;

  get diagnostics affected = row_count;
  updated := affected > 0;
  return updated;
end;
$$;

revoke all on function public.complete_storage_cleanup(uuid, boolean, text)
from public, anon, authenticated;
grant execute on function public.complete_storage_cleanup(uuid, boolean, text)
to service_role;
