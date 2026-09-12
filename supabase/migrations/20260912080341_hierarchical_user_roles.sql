alter table public.profiles
add column if not exists role text not null default 'member';

update public.profiles
set role = 'admin'
where is_admin
  and role <> 'admin';

alter table public.profiles
drop constraint if exists profiles_role_check;

alter table public.profiles
add constraint profiles_role_check
check (role in ('member', 'contributor', 'admin'));

create or replace function private.sync_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_admin then
      new.role := 'admin';
    else
      new.is_admin := new.role = 'admin';
    end if;
  elsif new.role is distinct from old.role then
    new.is_admin := new.role = 'admin';
  elsif new.is_admin is distinct from old.is_admin then
    new.role := case when new.is_admin then 'admin' else 'member' end;
  end if;

  return new;
end;
$$;

revoke all on function private.sync_profile_role() from public;

drop trigger if exists profiles_sync_role on public.profiles;
create trigger profiles_sync_role
before insert or update of role, is_admin on public.profiles
for each row execute function private.sync_profile_role();

create or replace function private.preserve_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  remaining_admins integer;
begin
  if old.role <> 'admin' then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' and new.role = 'admin' then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('flashover78:last-admin', 0)
  );

  select count(*)
  into remaining_admins
  from public.profiles
  where role = 'admin'
    and id <> old.id;

  if remaining_admins = 0 then
    raise exception 'Le dernier administrateur ne peut pas être rétrogradé ou supprimé';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function private.preserve_last_admin() from public;

drop trigger if exists profiles_preserve_last_admin on public.profiles;
drop trigger if exists profiles_validate_last_admin on public.profiles;
create trigger profiles_validate_last_admin
before update of role, is_admin or delete on public.profiles
for each row execute function private.preserve_last_admin();

create or replace function private.role_rank(p_role text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'admin' then 30
    when 'contributor' then 20
    when 'member' then 10
    else 0
  end;
$$;

create or replace function private.current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select profile.role
      from public.profiles as profile
      where profile.id = (select auth.uid())
    ),
    'member'
  );
$$;

create or replace function private.has_role(p_required_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_required_role in ('member', 'contributor', 'admin')
    and private.role_rank(private.current_role()) >= private.role_rank(p_required_role);
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

revoke all on function private.role_rank(text) from public;
revoke all on function private.current_role() from public;
revoke all on function private.has_role(text) from public;
revoke all on function private.is_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.has_role(text) to authenticated;
grant execute on function private.is_admin() to authenticated;

drop policy if exists "events_insert_admin_only" on public.events;
drop policy if exists "events_update_admin_only" on public.events;
drop policy if exists "events_delete_admin_only" on public.events;
drop policy if exists "events_insert_contributor" on public.events;
drop policy if exists "events_update_contributor" on public.events;
drop policy if exists "events_delete_admin" on public.events;

create policy "events_insert_contributor"
on public.events
for insert
to authenticated
with check ((select private.has_role('contributor')));

create policy "events_update_contributor"
on public.events
for update
to authenticated
using ((select private.has_role('contributor')))
with check ((select private.has_role('contributor')));

create policy "events_delete_admin"
on public.events
for delete
to authenticated
using ((select private.has_role('admin')));

create or replace function private.enforce_training_registration_admin_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
    and not (select private.has_role('admin')) then
    raise exception 'Le calendrier est accessible en consultation uniquement';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_training_registration_admin_mutation() from public;

drop trigger if exists training_registrations_admin_mutation
on public.training_registrations;
create trigger training_registrations_admin_mutation
before insert or update or delete on public.training_registrations
for each row execute function private.enforce_training_registration_admin_mutation();

drop policy if exists "documents_insert_admin_only" on storage.objects;
drop policy if exists "documents_update_admin_only" on storage.objects;
drop policy if exists "documents_delete_admin_only" on storage.objects;
drop policy if exists "documents_insert_contributor" on storage.objects;
drop policy if exists "documents_update_contributor" on storage.objects;
drop policy if exists "documents_delete_admin" on storage.objects;

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
  and (select private.has_role('contributor'))
);

create policy "documents_update_contributor"
on storage.objects
for update
to authenticated
using (
  bucket_id in (
    'sdis78-documents',
    'lectures-documents',
    'brulage-documents',
    'resources'
  )
  and (select private.has_role('contributor'))
)
with check (
  bucket_id in (
    'sdis78-documents',
    'lectures-documents',
    'brulage-documents',
    'resources'
  )
  and (select private.has_role('contributor'))
);

create policy "documents_delete_admin"
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
  and (select private.has_role('admin'))
);

create or replace function public.create_document(
  p_title text,
  p_category text,
  p_tags text[],
  p_version_label text,
  p_author_name text,
  p_effective_at date,
  p_expires_at date,
  p_bucket_id text,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_file_size bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  new_resource_id uuid := gen_random_uuid();
  new_version_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentification requise';
  end if;

  if not (select private.has_role('contributor')) then
    raise exception 'Action réservée aux contributeurs';
  end if;

  if nullif(trim(p_title), '') is null then
    raise exception 'Le titre du document est requis';
  end if;

  if p_category not in (
    'SDIS78',
    'GDO_GTO',
    'LECTURES',
    'AUTRE',
    'BRULAGE_TDL_FO',
    'BRULAGE_MAF'
  ) then
    raise exception 'Catégorie documentaire invalide';
  end if;

  if nullif(trim(p_version_label), '') is null then
    raise exception 'La version du document est requise';
  end if;

  if p_expires_at is not null
    and p_effective_at is not null
    and p_expires_at < p_effective_at then
    raise exception 'La date d’expiration doit suivre la date d’effet';
  end if;

  perform private.validate_document_storage(p_bucket_id, p_storage_path, p_file_size);

  insert into public.resources (
    id, title, category, file_url, bucket_id, current_storage_path,
    version_label, author_name, tags, effective_at, expires_at,
    original_filename, mime_type, file_size, updated_at, updated_by
  )
  values (
    new_resource_id, trim(p_title), p_category,
    '/app/resources/' || new_resource_id::text, p_bucket_id, p_storage_path,
    trim(p_version_label), coalesce(trim(p_author_name), ''), coalesce(p_tags, '{}'),
    p_effective_at, p_expires_at, p_original_filename, p_mime_type, p_file_size,
    timezone('utc', now()), current_user_id
  );

  insert into public.resource_versions (
    resource_id, version_label, bucket_id, storage_path, original_filename,
    mime_type, file_size, author_name, effective_at, expires_at, uploaded_by
  )
  values (
    new_resource_id, trim(p_version_label), p_bucket_id, p_storage_path,
    p_original_filename, p_mime_type, p_file_size,
    coalesce(trim(p_author_name), ''), p_effective_at, p_expires_at, current_user_id
  )
  returning id into new_version_id;

  update public.resources
  set current_version_id = new_version_id
  where id = new_resource_id;

  insert into public.document_audit_log (
    resource_id, version_id, actor_id, action, details
  )
  values (
    new_resource_id, new_version_id, current_user_id, 'document.created',
    jsonb_build_object('category', p_category, 'version', trim(p_version_label))
  );

  return new_resource_id;
end;
$$;

create or replace function public.register_document_version(
  p_resource_id uuid,
  p_version_label text,
  p_author_name text,
  p_effective_at date,
  p_expires_at date,
  p_bucket_id text,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_file_size bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_resource public.resources;
  new_version_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentification requise';
  end if;

  if not (select private.has_role('contributor')) then
    raise exception 'Action réservée aux contributeurs';
  end if;

  if nullif(trim(p_version_label), '') is null then
    raise exception 'La version du document est requise';
  end if;

  if p_expires_at is not null
    and p_effective_at is not null
    and p_expires_at < p_effective_at then
    raise exception 'La date d’expiration doit suivre la date d’effet';
  end if;

  perform private.validate_document_storage(p_bucket_id, p_storage_path, p_file_size);

  select *
  into target_resource
  from public.resources
  where id = p_resource_id
  for update;

  if not found then
    raise exception 'Document introuvable';
  end if;

  insert into public.resource_versions (
    resource_id, version_label, bucket_id, storage_path, original_filename,
    mime_type, file_size, author_name, effective_at, expires_at, uploaded_by
  )
  values (
    p_resource_id, trim(p_version_label), p_bucket_id, p_storage_path,
    p_original_filename, p_mime_type, p_file_size,
    coalesce(trim(p_author_name), target_resource.author_name),
    p_effective_at, p_expires_at, current_user_id
  )
  returning id into new_version_id;

  update public.resources
  set
    current_version_id = new_version_id,
    bucket_id = p_bucket_id,
    current_storage_path = p_storage_path,
    version_label = trim(p_version_label),
    author_name = coalesce(trim(p_author_name), author_name),
    effective_at = p_effective_at,
    expires_at = p_expires_at,
    original_filename = p_original_filename,
    mime_type = p_mime_type,
    file_size = p_file_size,
    updated_at = timezone('utc', now()),
    updated_by = current_user_id
  where id = p_resource_id;

  insert into public.document_audit_log (
    resource_id, version_id, actor_id, action, details
  )
  values (
    p_resource_id, new_version_id, current_user_id, 'document.version_added',
    jsonb_build_object(
      'previous_version', target_resource.version_label,
      'version', trim(p_version_label)
    )
  );

  return new_version_id;
end;
$$;

create or replace function public.update_document_metadata(
  p_resource_id uuid,
  p_title text,
  p_category text,
  p_tags text[],
  p_author_name text,
  p_effective_at date,
  p_expires_at date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentification requise';
  end if;

  if not (select private.has_role('contributor')) then
    raise exception 'Action réservée aux contributeurs';
  end if;

  if nullif(trim(p_title), '') is null then
    raise exception 'Le titre du document est requis';
  end if;

  if p_category not in (
    'SDIS78',
    'GDO_GTO',
    'LECTURES',
    'AUTRE',
    'BRULAGE_TDL_FO',
    'BRULAGE_MAF'
  ) then
    raise exception 'Catégorie documentaire invalide';
  end if;

  if p_expires_at is not null
    and p_effective_at is not null
    and p_expires_at < p_effective_at then
    raise exception 'La date d’expiration doit suivre la date d’effet';
  end if;

  update public.resources
  set
    title = trim(p_title),
    category = p_category,
    tags = coalesce(p_tags, '{}'),
    author_name = coalesce(trim(p_author_name), ''),
    effective_at = p_effective_at,
    expires_at = p_expires_at,
    updated_at = timezone('utc', now()),
    updated_by = current_user_id
  where id = p_resource_id;

  if not found then
    raise exception 'Document introuvable';
  end if;

  insert into public.document_audit_log (resource_id, actor_id, action, details)
  values (
    p_resource_id, current_user_id, 'document.metadata_updated',
    jsonb_build_object('category', p_category)
  );
end;
$$;

revoke all on function public.create_document(
  text, text, text[], text, text, date, date, text, text, text, text, bigint
) from public, anon;
revoke all on function public.register_document_version(
  uuid, text, text, date, date, text, text, text, text, bigint
) from public, anon;
revoke all on function public.update_document_metadata(
  uuid, text, text, text[], text, date, date
) from public, anon;

grant execute on function public.create_document(
  text, text, text[], text, text, date, date, text, text, text, text, bigint
) to authenticated;
grant execute on function public.register_document_version(
  uuid, text, text, date, date, text, text, text, text, bigint
) to authenticated;
grant execute on function public.update_document_metadata(
  uuid, text, text, text[], text, date, date
) to authenticated;
