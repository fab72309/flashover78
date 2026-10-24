-- Read-only production inventory for an authorized Supabase operator.
-- Do not run from the browser or paste returned paths/identifiers into tests.
-- This script performs no deletion, update, migration or secret rotation.

-- 1. Bucket posture and configured limits.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in (
  'sdis78-documents',
  'lectures-documents',
  'brulage-documents',
  'resources',
  'news-images',
  'main-courantes',
  'equipment-repair-requests'
)
order by id;

-- 2. Counts and byte totals, without returning object names.
select
  bucket_id,
  count(*)::bigint as object_count,
  coalesce(sum(
    case
      when metadata ->> 'size' ~ '^[0-9]+$'
       and length(metadata ->> 'size') <= 18
      then (metadata ->> 'size')::bigint
      else 0
    end
  ), 0)::bigint as declared_bytes,
  count(*) filter (
    where metadata ->> 'size' is null
       or metadata ->> 'size' !~ '^[0-9]+$'
       or length(metadata ->> 'size') > 18
  )::bigint as invalid_size_metadata
from storage.objects
group by bucket_id
order by bucket_id;

-- 3. References whose object is absent (counts only).
with refs as (
  select 'resources'::text as source, bucket_id, current_storage_path as storage_path
  from public.resources
  union all
  select 'resource_versions', bucket_id, storage_path
  from public.resource_versions
  union all
  select 'main_courantes', 'main-courantes', pdf_storage_path
  from public.main_courantes
  union all
  select 'equipment_repair_requests', 'equipment-repair-requests', pdf_storage_path
  from public.equipment_repair_requests
)
select source, bucket_id, count(*)::bigint as broken_reference_count
from refs
where not exists (
  select 1
  from storage.objects as object
  where object.bucket_id = refs.bucket_id
    and object.name = refs.storage_path
)
group by source, bucket_id
order by source, bucket_id;

-- 4. Objects without a current catalogue/form reference (counts only).
select object.bucket_id, count(*)::bigint as orphan_count
from storage.objects as object
where object.bucket_id in (
    'sdis78-documents',
    'lectures-documents',
    'brulage-documents',
    'resources',
    'main-courantes',
    'equipment-repair-requests'
  )
  and not exists (
    select 1 from public.resources as resource
    where resource.bucket_id = object.bucket_id
      and resource.current_storage_path = object.name
  )
  and not exists (
    select 1 from public.resource_versions as version
    where version.bucket_id = object.bucket_id
      and version.storage_path = object.name
  )
  and not (
    object.bucket_id = 'main-courantes'
    and exists (select 1 from public.main_courantes where pdf_storage_path = object.name)
  )
  and not (
    object.bucket_id = 'equipment-repair-requests'
    and exists (select 1 from public.equipment_repair_requests where pdf_storage_path = object.name)
  )
group by object.bucket_id
order by object.bucket_id;

-- 4b. The legacy news-images bucket has no current public.news consumer in
-- the migration history. Keep its inventory separate so an operator can
-- decide whether the objects are still needed; this query never returns
-- object names and never deletes anything.
select
  'news-images'::text as bucket_id,
  count(*)::bigint as orphan_count,
  coalesce(sum(
    case
      when metadata ->> 'size' ~ '^[0-9]+$'
       and length(metadata ->> 'size') <= 18
      then (metadata ->> 'size')::bigint
      else 0
    end
  ), 0)::bigint as declared_bytes
from storage.objects
where bucket_id = 'news-images';

-- 4c. Namespace and ownership anomalies in private application buckets.
-- These counts identify objects that should not be purged automatically.
select
  object.bucket_id,
  count(*) filter (where object.owner_id is null)::bigint as missing_owner_count,
  count(*) filter (
    where object.bucket_id in ('main-courantes', 'equipment-repair-requests')
      and (storage.foldername(object.name))[1] is distinct from object.owner_id
  )::bigint as owner_namespace_mismatch_count
from storage.objects as object
where object.bucket_id in (
  'sdis78-documents',
  'lectures-documents',
  'brulage-documents',
  'resources',
  'news-images',
  'main-courantes',
  'equipment-repair-requests'
)
group by object.bucket_id
order by object.bucket_id;

-- 4d. Legacy OLE Office objects requiring quarantine review. Return only
-- extension/count/declared bytes; never expose object names or user data.
select
  object.bucket_id,
  lower(regexp_replace(object.name, '^.*\.', '')) as extension,
  count(*)::bigint as object_count,
  coalesce(sum(
    case
      when object.metadata ->> 'size' ~ '^[0-9]+$'
       and length(object.metadata ->> 'size') <= 18
      then (object.metadata ->> 'size')::bigint
      else 0
    end
  ), 0)::bigint as declared_bytes
from storage.objects as object
where object.bucket_id in (
  'sdis78-documents',
  'lectures-documents',
  'brulage-documents',
  'resources'
)
  and lower(object.name) ~ '\.(doc|ppt)$'
group by object.bucket_id, lower(regexp_replace(object.name, '^.*\.', ''))
order by object.bucket_id, extension;

-- 5. Constraints intentionally deployed as NOT VALID and requiring a later
-- validation after the historical-data review.
select
  n.nspname as schema_name,
  c.relname as table_name,
  con.conname,
  con.convalidated
from pg_constraint as con
join pg_class as c on c.oid = con.conrelid
join pg_namespace as n on n.oid = c.relnamespace
where not con.convalidated
  and n.nspname = 'public'
order by c.relname, con.conname;

-- 6. Pending finalizer approvals. These rows are metadata only; the query
-- deliberately returns counts rather than paths or user identifiers.
select 'form_pdf'::text as approval_kind,
       count(*) filter (where consumed_at is null)::bigint as pending_count,
       count(*) filter (where consumed_at is null and expires_at < timezone('utc', now()))::bigint as expired_pending_count
from private.form_pdf_upload_approvals
union all
select 'catalog_document'::text,
       count(*) filter (where consumed_at is null)::bigint,
       count(*) filter (where consumed_at is null and expires_at < timezone('utc', now()))::bigint
from private.document_upload_approvals
union all
select 'form_pdf_missing_object'::text,
       count(*) filter (where approval.consumed_at is null)::bigint,
       count(*) filter (where approval.consumed_at is null and approval.expires_at < timezone('utc', now()))::bigint
from private.form_pdf_upload_approvals as approval
where not exists (
  select 1
  from storage.objects as object
  where object.bucket_id = approval.bucket_id
    and object.name = approval.storage_path
)
union all
select 'catalog_document_missing_object'::text,
       count(*) filter (where approval.consumed_at is null)::bigint,
       count(*) filter (where approval.consumed_at is null and approval.expires_at < timezone('utc', now()))::bigint
from private.document_upload_approvals as approval
where not exists (
  select 1
  from storage.objects as object
  where object.bucket_id = approval.bucket_id
    and object.name = approval.storage_path
);
