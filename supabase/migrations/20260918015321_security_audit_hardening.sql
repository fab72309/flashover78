-- Security audit hardening (2026-09-18).
-- This migration is intentionally additive: it replaces vulnerable function
-- bodies and narrows grants/policies without rewriting migration history.

-- A revoked Supabase Auth session must not retain administrator privileges
-- until the access token expires. The JWT session_id is checked against the
-- Auth-owned session table for every admin/MFA decision.
create or replace function private.has_active_session()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select auth.uid()) is not null
    and nullif((select auth.jwt()->>'session_id'), '') is not null
    and exists (
      select 1
      from auth.sessions as session
      where session.id::text = (select auth.jwt()->>'session_id')
        and session.user_id = (select auth.uid())
    ),
    false
  );
$$;

revoke all on function private.has_active_session() from public, anon;

create or replace function private.has_admin_mfa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.has_active_session()
    and (select auth.jwt()->>'aal') = 'aal2'
    and (select auth.jwt()->'amr') @> '[{"method":"totp"}]'::jsonb
    and exists (
      select 1
      from auth.mfa_factors as factor
      where factor.user_id = (select auth.uid())
        and factor.factor_type = 'totp'
        and factor.status = 'verified'
    ),
    false
  );
$$;

revoke all on function private.has_admin_mfa() from public, anon;
grant execute on function private.has_admin_mfa() to authenticated;

-- All privilege checks built on these helpers also require a live Auth
-- session. This closes the common contributor/admin paths immediately after
-- session revocation; ordinary read policies still need short JWT expiry or
-- an explicit active-session predicate when immediate revocation is required.
create or replace function private.has_role(p_required_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_active_session()
    and p_required_role in ('member', 'contributor', 'admin')
    and private.role_rank(private.current_role()) >= private.role_rank(p_required_role)
    and (p_required_role <> 'admin' or private.has_admin_mfa());
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role('admin');
$$;

revoke all on function private.has_role(text), private.is_admin()
from public, anon;
grant execute on function private.has_role(text), private.is_admin()
to authenticated;

-- Account creation may never bootstrap an administrator from public signup.
-- Initial administrators must be provisioned through an explicitly authorized
-- out-of-band operation. Existing roles are left untouched on profile sync.
create or replace function public.sync_my_profile(
  p_display_name text,
  p_first_name text default null,
  p_last_name text default null,
  p_phone text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_email text;
  synced_profile public.profiles;
begin
  if current_user_id is null or not private.has_active_session() then
    raise exception 'Authentification requise';
  end if;

  select auth_user.email
  into current_email
  from auth.users as auth_user
  where auth_user.id = current_user_id;

  if current_email is null then
    raise exception 'Compte utilisateur introuvable';
  end if;

  insert into public.profiles (
    id, email, display_name, first_name, last_name, phone, is_admin, role
  )
  values (
    current_user_id,
    current_email,
    nullif(trim(p_display_name), ''),
    nullif(trim(p_first_name), ''),
    nullif(trim(p_last_name), ''),
    nullif(trim(p_phone), ''),
    false,
    'member'
  )
  on conflict (id) do update
  set
    email = current_email,
    display_name = excluded.display_name,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    phone = excluded.phone
  returning * into synced_profile;

  return synced_profile;
end;
$$;

revoke all on function public.sync_my_profile(text, text, text, text)
from public, anon;
grant execute on function public.sync_my_profile(text, text, text, text)
to authenticated;

-- Profile values are still user-controlled through the synchronization RPC;
-- bound them server-side without rewriting historical rows during deployment.
alter table public.profiles
  add constraint profiles_text_limits
  check (
    length(email) between 3 and 254
    and length(display_name) between 1 and 200
    and length(coalesce(first_name, '')) <= 100
    and length(coalesce(last_name, '')) <= 100
    and length(coalesce(phone, '')) <= 64
  ) not valid;

-- Contributors can update scheduling content, but capacity is a privileged
-- invariant managed only by set_training_capacity(), which requires admin
-- AAL2 and writes the training audit log. Inserts use the database default.
revoke insert, update on table public.events from authenticated;
grant insert (
  title,
  description,
  observations,
  location,
  formateurs,
  formateur_ids,
  formateur_levels,
  date,
  registration_closes_at
) on table public.events to authenticated;
grant update (
  title,
  description,
  observations,
  location,
  formateurs,
  formateur_ids,
  formateur_levels,
  date,
  registration_closes_at
) on table public.events to authenticated;

alter table public.events
  add constraint events_text_limits
  check (
    length(title) between 1 and 200
    and length(description) <= 10000
    and length(coalesce(observations, '')) <= 10000
    and length(coalesce(location, '')) <= 500
    and cardinality(coalesce(formateurs, '{}')) <= 20
    and length(array_to_string(coalesce(formateurs, '{}'), ' ')) <= 4000
    and cardinality(coalesce(formateur_ids, '{}')) <= 20
    and cardinality(coalesce(formateur_levels, '{}')) <= 20
    and length(array_to_string(coalesce(formateur_levels, '{}'), ' ')) <= 800
  ) not valid;

-- Document objects are immutable. New catalog versions must use a new path;
-- direct replacement would bypass resource_versions and its audit trail.
drop policy if exists "documents_update_contributor" on storage.objects;

create or replace function private.validate_document_storage(
  p_bucket_id text,
  p_storage_path text,
  p_file_size bigint
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_bucket_id not in (
    'sdis78-documents',
    'lectures-documents',
    'brulage-documents',
    'resources'
  ) then
    raise exception 'Compartiment documentaire invalide';
  end if;

  if nullif(trim(p_storage_path), '') is null
    or p_storage_path like '/%'
    or p_storage_path like '%..%'
    or length(p_storage_path) > 500
    or lower(p_storage_path) !~ '\.(pdf|odt|doc|docx|ppt|pptx|txt)$' then
    raise exception 'Chemin ou extension de stockage invalide';
  end if;

  if p_file_size < 1 or p_file_size > 20971520 then
    raise exception 'La taille du document doit être comprise entre 1 octet et 20 Mo';
  end if;
end;
$$;

revoke all on function private.validate_document_storage(text, text, bigint)
from public;

-- Storage metadata is not a substitute for malware analysis, but it must still
-- be checked server-side for direct API uploads. The quota is deliberately
-- bounded per owner so an authorized contributor cannot fill a bucket with
-- unreferenced objects by bypassing the catalog RPC.
create or replace function private.document_storage_upload_allowed(
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
  size_text text := nullif(p_metadata ->> 'size', '');
  size_bytes bigint;
  existing_bytes bigint;
  existing_objects bigint;
begin
  if current_user_id is null
     or not private.has_active_session()
     or not (select private.has_role('contributor'))
     or p_bucket_id not in (
       'sdis78-documents',
       'lectures-documents',
       'brulage-documents',
       'resources'
     )
     or nullif(trim(p_storage_path), '') is null
     or p_storage_path like '/%'
     or p_storage_path like '%..%'
     or length(p_storage_path) > 500
     or (storage.foldername(p_storage_path))[1] <> current_user_id::text
     or lower(p_storage_path) !~ '\.(pdf|odt|doc|docx|ppt|pptx|txt)$'
     or size_text is null
     or size_text !~ '^[0-9]+$'
     or length(size_text) > 10
     or not (
       (lower(p_storage_path) ~ '\.pdf$' and (p_metadata ->> 'mimetype') = 'application/pdf')
       or (lower(p_storage_path) ~ '\.odt$' and (p_metadata ->> 'mimetype') = 'application/vnd.oasis.opendocument.text')
       or (lower(p_storage_path) ~ '\.doc$' and (p_metadata ->> 'mimetype') = 'application/msword')
       or (lower(p_storage_path) ~ '\.docx$' and (p_metadata ->> 'mimetype') = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
       or (lower(p_storage_path) ~ '\.ppt$' and (p_metadata ->> 'mimetype') = 'application/vnd.ms-powerpoint')
       or (lower(p_storage_path) ~ '\.pptx$' and (p_metadata ->> 'mimetype') = 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
       or (lower(p_storage_path) ~ '\.txt$' and (p_metadata ->> 'mimetype') = 'text/plain')
     ) then
    return false;
  end if;

  size_bytes := size_text::bigint;
  if size_bytes < 1 or size_bytes > 20971520 then
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
    and object.bucket_id in (
      'sdis78-documents',
      'lectures-documents',
      'brulage-documents',
      'resources'
    );

  return existing_objects < 200
    and existing_bytes + size_bytes <= 104857600;
end;
$$;

revoke all on function private.document_storage_upload_allowed(text, text, jsonb)
from public, anon;
grant execute on function private.document_storage_upload_allowed(text, text, jsonb)
to authenticated;

drop policy if exists "documents_insert_contributor" on storage.objects;
create policy "documents_insert_contributor"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in (
    'sdis78-documents',
    'lectures-documents',
    'brulage-documents',
    'resources'
  )
  and lower(name) ~ '\.(pdf|odt|doc|docx|ppt|pptx|txt)$'
  and (select private.document_storage_upload_allowed(bucket_id, name, metadata))
);

drop policy if exists "documents_delete_unreferenced_owner" on storage.objects;
create policy "documents_delete_unreferenced_owner"
on storage.objects
for delete
to authenticated
using (
  bucket_id in (
    'sdis78-documents',
    'lectures-documents',
    'brulage-documents',
    'resources'
  )
  and owner_id = (select auth.uid())::text
  and not exists (
    select 1
    from public.resources as resource
    where resource.bucket_id = storage.objects.bucket_id
      and resource.current_storage_path = storage.objects.name
  )
  and not exists (
    select 1
    from public.resource_versions as version
    where version.bucket_id = storage.objects.bucket_id
      and version.storage_path = storage.objects.name
  )
);

-- Form-generated PDFs use separate private buckets. Direct Storage uploads
-- must keep the user/id namespace, PDF extension, declared MIME and 5 MiB
-- bucket limit even when the catalog insert is bypassed.
create or replace function private.pdf_storage_upload_allowed(
  p_bucket_id text,
  p_storage_path text,
  p_metadata jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  path_parts text[];
  size_text text := nullif(p_metadata ->> 'size', '');
  size_bytes bigint;
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
  return size_bytes between 1 and 5242880;
end;
$$;

revoke all on function private.pdf_storage_upload_allowed(text, text, jsonb)
from public, anon;
grant execute on function private.pdf_storage_upload_allowed(text, text, jsonb)
to authenticated;

drop policy if exists "main_courantes_storage_insert_own" on storage.objects;
create policy "main_courantes_storage_insert_own"
on storage.objects
for insert
to authenticated
with check (
  (select private.pdf_storage_upload_allowed(bucket_id, name, metadata))
);

drop policy if exists "equipment_repair_requests_storage_insert_own"
on storage.objects;
create policy "equipment_repair_requests_storage_insert_own"
on storage.objects
for insert
to authenticated
with check (
  (select private.pdf_storage_upload_allowed(bucket_id, name, metadata))
);

-- A submitted PDF is immutable. Owners may only clean up their own upload
-- when no durable business record references it (for example after an insert
-- failure), preserving both cleanup and archive integrity.
drop policy if exists "main_courantes_storage_delete_own" on storage.objects;
create policy "main_courantes_storage_delete_unreferenced_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'main-courantes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (
    select 1
    from public.main_courantes as record
    where record.user_id = (select auth.uid())
      and record.pdf_storage_path = storage.objects.name
  )
);

drop policy if exists "equipment_repair_requests_storage_delete_own"
on storage.objects;
create policy "equipment_repair_requests_storage_delete_unreferenced_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'equipment-repair-requests'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (
    select 1
    from public.equipment_repair_requests as record
    where record.user_id = (select auth.uid())
      and record.pdf_storage_path = storage.objects.name
  )
);

-- Legacy contacts: drivers/admins only receive accepted passengers; accepted
-- passengers receive only the driver. Pending/rejected/cancelled requests do
-- not disclose coordinates.
create or replace function public.get_carpool_contacts(p_trip_id uuid)
returns table (user_id uuid, email text, phone text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_trip public.carpool_trips;
begin
  if current_user_id is null or not private.has_active_session() then
    raise exception 'Authentification requise';
  end if;

  select * into target_trip
  from public.carpool_trips
  where id = p_trip_id;

  if not found then
    raise exception 'Trajet introuvable';
  end if;

  if target_trip.driver_id = current_user_id or (select private.is_admin()) then
    return query
    select profile.id, profile.email, profile.phone
    from public.profiles as profile
    where profile.id = target_trip.driver_id
      or profile.id in (
        select request.requester_id
        from public.carpool_requests as request
        where request.trip_id = p_trip_id
          and request.status = 'accepted'
      );
    return;
  end if;

  if exists (
    select 1
    from public.carpool_requests as request
    where request.trip_id = p_trip_id
      and request.requester_id = current_user_id
      and request.status = 'accepted'
  ) then
    return query
    select profile.id, profile.email, profile.phone
    from public.profiles as profile
    where profile.id = target_trip.driver_id;
  end if;
end;
$$;

revoke all on function public.get_carpool_contacts(uuid) from public, anon;
grant execute on function public.get_carpool_contacts(uuid) to authenticated;

-- Current mobility contacts: the post owner/admin can see accepted
-- counterparts. An accepted counterpart sees only the owner of the requested
-- post, never another passenger attached to the same offer.
create or replace function public.get_carpool_post_contacts(p_post_id uuid)
returns table (user_id uuid, email text, phone text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_post public.carpool_posts;
begin
  if current_user_id is null or not private.has_active_session() then
    raise exception 'Authentification requise';
  end if;

  select * into target_post
  from public.carpool_posts
  where id = p_post_id;

  if not found then
    raise exception 'Publication introuvable';
  end if;

  if target_post.author_id = current_user_id or (select private.is_admin()) then
    return query
    select distinct profile.id, profile.email, profile.phone
    from public.profiles as profile
    where profile.id = target_post.author_id
       or profile.id in (
         select case
           when match.offer_post_id = p_post_id then need.author_id
           else offer.author_id
         end
         from public.carpool_matches as match
         join public.carpool_posts as offer on offer.id = match.offer_post_id
         join public.carpool_posts as need on need.id = match.need_post_id
         where match.status = 'accepted'
           and (match.offer_post_id = p_post_id or match.need_post_id = p_post_id)
       );
    return;
  end if;

  if exists (
    select 1
    from public.carpool_matches as match
    join public.carpool_posts as offer on offer.id = match.offer_post_id
    join public.carpool_posts as need on need.id = match.need_post_id
    where match.status = 'accepted'
      and (match.offer_post_id = p_post_id or match.need_post_id = p_post_id)
      and current_user_id in (offer.author_id, need.author_id)
  ) then
    return query
    select profile.id, profile.email, profile.phone
    from public.profiles as profile
    where profile.id = target_post.author_id;
    return;
  end if;

  raise exception 'Contacts disponibles après validation uniquement';
end;
$$;

revoke all on function public.get_carpool_post_contacts(uuid) from public, anon;
grant execute on function public.get_carpool_post_contacts(uuid) to authenticated;

-- Append-only business audit for privileged account/configuration operations.
-- Auth audit logs and business audit logs have distinct purposes and retention.
create table if not exists public.admin_operation_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text not null check (actor_role = 'admin'),
  action text not null check (action in (
    'invite_user',
    'create_user',
    'delete_user',
    'update_role',
    'update_trainer_levels',
    'update_email_destinations'
  )),
  target_user_id uuid,
  outcome text not null check (outcome in ('attempt', 'success', 'failure')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists admin_operation_audit_created_at_idx
on public.admin_operation_audit (created_at desc, id desc);

alter table public.admin_operation_audit enable row level security;
alter table public.admin_operation_audit force row level security;
revoke all on table public.admin_operation_audit from public, anon, authenticated;
revoke update, delete, truncate on table public.admin_operation_audit from service_role;
grant insert, select on table public.admin_operation_audit to service_role;

create or replace function public.list_admin_operation_audit(
  p_before timestamptz default null,
  p_before_id uuid default null
)
returns table (
  id uuid,
  actor_id uuid,
  action text,
  target_user_id uuid,
  outcome text,
  details jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_role('admin') then
    raise exception 'Administrator TOTP authentication required'
      using errcode = '42501';
  end if;

  return query
  select
    audit.id,
    audit.actor_id,
    audit.action,
    audit.target_user_id,
    audit.outcome,
    audit.details,
    audit.created_at
  from public.admin_operation_audit as audit
  where p_before is null
     or audit.created_at < p_before
     or (
       audit.created_at = p_before
       and p_before_id is not null
       and audit.id < p_before_id
     )
  order by audit.created_at desc, audit.id desc
  limit 100;
end;
$$;

revoke all on function public.list_admin_operation_audit(timestamptz, uuid)
from public, anon;
grant execute on function public.list_admin_operation_audit(timestamptz, uuid)
to authenticated;

-- A user-wide window limits abuse across all three form email functions. The
-- row is private and is consumed in the same transaction as the submission
-- claim, so a rejected quota does not consume an email attempt.
create table if not exists private.form_email_rate_limits (
  actor_id uuid primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 0
    check (request_count between 0 and 20)
);

alter table public.email_destinations
  add constraint email_destinations_recipient_length
  check (
    length(array_to_string(recipients, '')) <= 5080
  ) not valid;

revoke all on table private.form_email_rate_limits from public, anon, authenticated;

create or replace function private.consume_form_email_rate_limit(p_actor_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_window_started_at timestamptz;
  current_request_count integer;
begin
  if p_actor_id is null then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_id::text, 0)
  );

  insert into private.form_email_rate_limits(actor_id, window_started_at, request_count)
  values (p_actor_id, timezone('utc', now()), 0)
  on conflict (actor_id) do nothing;

  select window_started_at, request_count
  into current_window_started_at, current_request_count
  from private.form_email_rate_limits
  where actor_id = p_actor_id
  for update;

  if current_window_started_at <= timezone('utc', now()) - interval '1 hour' then
    update private.form_email_rate_limits
    set window_started_at = timezone('utc', now()), request_count = 1
    where actor_id = p_actor_id;
    return true;
  end if;

  if current_request_count >= 20 then
    return false;
  end if;

  update private.form_email_rate_limits
  set request_count = request_count + 1
  where actor_id = p_actor_id;
  return true;
end;
$$;

revoke all on function private.consume_form_email_rate_limit(uuid)
from public, anon, authenticated;

-- Email delivery is claimed atomically before an external provider call. This
-- closes the check-then-send race, applies a one-minute resend cooldown and a
-- five-attempt cap per submission and a twenty-per-hour user-wide quota. A
-- stale ten-minute claim can be recovered.
alter table public.medical_follow_ups
  add column if not exists email_attempt_count integer not null default 0,
  add column if not exists email_last_attempt_at timestamptz;
alter table public.main_courantes
  add column if not exists email_attempt_count integer not null default 0,
  add column if not exists email_last_attempt_at timestamptz;
alter table public.equipment_repair_requests
  add column if not exists email_attempt_count integer not null default 0,
  add column if not exists email_last_attempt_at timestamptz;

alter table public.medical_follow_ups
  drop constraint if exists medical_follow_ups_email_status_check;
alter table public.medical_follow_ups
  add constraint medical_follow_ups_email_status_check
  check (email_status in ('pending', 'sending', 'sent', 'failed'));

alter table public.main_courantes
  drop constraint if exists main_courantes_email_status_check;
alter table public.main_courantes
  add constraint main_courantes_email_status_check
  check (email_status in ('pending', 'sending', 'sent', 'failed'));

alter table public.equipment_repair_requests
  drop constraint if exists equipment_repair_requests_email_status_check;
alter table public.equipment_repair_requests
  add constraint equipment_repair_requests_email_status_check
  check (email_status in ('pending', 'sending', 'sent', 'failed'));

create or replace function public.claim_form_email_delivery(
  p_form_key text,
  p_submission_id uuid,
  p_allow_resend boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  claimed_id uuid;
begin
  if current_user_id is null or not private.has_active_session() then
    raise exception 'Authentification requise';
  end if;

  if p_form_key = 'suivi_medical' then
    update public.medical_follow_ups
    set
      email_status = 'sending',
      email_attempt_count = email_attempt_count + 1,
      email_last_attempt_at = timezone('utc', now()),
      email_error = null,
      updated_at = timezone('utc', now())
    where id = p_submission_id
      and user_id = current_user_id
      and email_attempt_count < 5
      and (
        email_status in ('pending', 'failed')
        or (
          email_status = 'sent'
          and p_allow_resend
          and coalesce(email_last_attempt_at, email_sent_at, created_at)
            < timezone('utc', now()) - interval '1 minute'
        )
        or (
          email_status = 'sending'
          and email_last_attempt_at < timezone('utc', now()) - interval '10 minutes'
        )
      )
    returning id into claimed_id;
  elsif p_form_key = 'main_courante' then
    update public.main_courantes
    set
      email_status = 'sending',
      email_attempt_count = email_attempt_count + 1,
      email_last_attempt_at = timezone('utc', now()),
      email_error = null,
      updated_at = timezone('utc', now())
    where id = p_submission_id
      and user_id = current_user_id
      and email_attempt_count < 5
      and (
        email_status in ('pending', 'failed')
        or (
          email_status = 'sent'
          and p_allow_resend
          and coalesce(email_last_attempt_at, email_sent_at, created_at)
            < timezone('utc', now()) - interval '1 minute'
        )
        or (
          email_status = 'sending'
          and email_last_attempt_at < timezone('utc', now()) - interval '10 minutes'
        )
      )
    returning id into claimed_id;
  elsif p_form_key = 'demande_reparation' then
    update public.equipment_repair_requests
    set
      email_status = 'sending',
      email_attempt_count = email_attempt_count + 1,
      email_last_attempt_at = timezone('utc', now()),
      email_error = null,
      updated_at = timezone('utc', now())
    where id = p_submission_id
      and user_id = current_user_id
      and email_attempt_count < 5
      and (
        email_status in ('pending', 'failed')
        or (
          email_status = 'sent'
          and p_allow_resend
          and coalesce(email_last_attempt_at, email_sent_at, created_at)
            < timezone('utc', now()) - interval '1 minute'
        )
        or (
          email_status = 'sending'
          and email_last_attempt_at < timezone('utc', now()) - interval '10 minutes'
        )
      )
    returning id into claimed_id;
  else
    raise exception 'Type de formulaire invalide';
  end if;

  if claimed_id is not null
     and not private.consume_form_email_rate_limit(current_user_id) then
    raise exception 'Email delivery rate limit exceeded';
  end if;

  return claimed_id is not null;
end;
$$;

revoke all on function public.claim_form_email_delivery(text, uuid, boolean)
from public, anon;
grant execute on function public.claim_form_email_delivery(text, uuid, boolean)
to authenticated;

-- Direct API calls receive the same resource bounds as the interface. These
-- NOT VALID constraints protect new/updated rows without making deployment
-- depend on historical data cleanup; production must validate them separately.
alter table public.carpool_posts
  add constraint carpool_posts_seat_limit
  check (
    coalesce(requested_seats, 1) between 1 and 8
    and coalesce(total_seats, 1) between 1 and 8
    and coalesce(available_seats, 0) between 0 and 8
  ) not valid;
alter table public.carpool_matches
  add constraint carpool_matches_seat_limit
  check (seats_requested between 1 and 8) not valid;
alter table public.carpool_trips
  add constraint carpool_trips_seat_limit
  check (
    total_seats between 1 and 8
    and available_seats between 0 and 8
  ) not valid;
alter table public.carpool_requests
  add constraint carpool_requests_seat_limit
  check (seats_requested between 1 and 8) not valid;

alter table public.carpool_posts
  add constraint carpool_posts_text_limits
  check (
    length(departure_city) <= 120
    and length(departure_label) <= 500
    and length(arrival_label) <= 500
    and length(coalesce(price_note, '')) <= 500
    and length(coalesce(vehicle_note, '')) <= 1000
    and length(coalesce(luggage_note, '')) <= 1000
    and length(coalesce(notes, '')) <= 4000
  ) not valid;
alter table public.carpool_matches
  add constraint carpool_matches_message_limit
  check (length(coalesce(message, '')) <= 4000) not valid;
alter table public.equipment_repair_requests
  add constraint equipment_repair_requests_text_limits
  check (
    length(coalesce(lieu_formation_autre, '')) <= 500
    and length(equipement) <= 200
    and length(coalesce(equipement_autre, '')) <= 500
    and length(coalesce(numero_inventaire, '')) <= 200
    and length(probleme) <= 10000
    and length(nom_demandeur) <= 300
  ) not valid;
alter table public.main_courantes
  add constraint main_courantes_text_limits
  check (
    length(coalesce(observations_difficultes, '')) <= 10000
    and length(coalesce(reparations_materiel, '')) <= 10000
  ) not valid;
alter table public.medical_follow_ups
  add constraint medical_follow_ups_text_limits
  check (
    length(nom_formateur) <= 200
    and length(prenom_formateur) <= 200
    and length(coalesce(observations, '')) <= 10000
    and length(coalesce(observations_post_bruleage_autre, '')) <= 4000
  ) not valid;

alter table public.resource_versions
  add constraint resource_versions_storage_owner_path
  check (
    split_part(storage_path, '/', 1) = uploaded_by::text
    and storage_path !~ '(^|/)\.\.(/|$)'
    and length(storage_path) <= 500
    and lower(storage_path) ~ '\.(pdf|odt|doc|docx|ppt|pptx|txt)$'
  ) not valid;

alter table public.resources
  add constraint resources_catalog_text_limits
  check (
    length(title) <= 200
    and length(version_label) <= 40
    and length(author_name) <= 200
    and length(coalesce(original_filename, '')) <= 180
    and cardinality(tags) <= 30
    and length(array_to_string(tags, ',')) <= 2400
  ) not valid;

alter table public.resource_versions
  add constraint resource_versions_catalog_text_limits
  check (
    length(version_label) <= 40
    and length(author_name) <= 200
    and length(original_filename) <= 180
  ) not valid;

create or replace function private.enforce_resource_version_storage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  object_metadata jsonb;
begin
  select object.metadata
  into object_metadata
  from storage.objects as object
  where object.bucket_id = new.bucket_id
    and object.name = new.storage_path
    and object.owner_id = new.uploaded_by::text;

  if not found then
    raise exception 'Le fichier documentaire doit exister dans Storage et appartenir à son téléverseur';
  end if;

  if (object_metadata ->> 'size') is not null
     and (object_metadata ->> 'size') ~ '^[0-9]+$'
     and length(object_metadata ->> 'size') <= 18
     and (object_metadata ->> 'size')::bigint <> new.file_size then
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

  return new;
end;
$$;

revoke all on function private.enforce_resource_version_storage() from public, anon;

drop trigger if exists resource_versions_validate_storage on public.resource_versions;
create trigger resource_versions_validate_storage
before insert on public.resource_versions
for each row execute function private.enforce_resource_version_storage();
