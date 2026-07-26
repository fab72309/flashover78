alter table public.resources
drop constraint if exists resources_category_check;

alter table public.resources
add constraint resources_category_check
check (
  category in (
    'SDIS78',
    'GDO_GTO',
    'LECTURES',
    'BRULAGE_TDL_FO',
    'BRULAGE_MAF'
  )
);

alter table public.resources
add column if not exists bucket_id text,
add column if not exists current_storage_path text,
add column if not exists version_label text not null default '1.0',
add column if not exists author_name text not null default '',
add column if not exists tags text[] not null default '{}',
add column if not exists effective_at date,
add column if not exists expires_at date,
add column if not exists original_filename text,
add column if not exists mime_type text,
add column if not exists file_size bigint,
add column if not exists updated_at timestamptz not null default timezone('utc', now()),
add column if not exists updated_by uuid references public.profiles(id) on delete set null,
add column if not exists search_vector tsvector;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'resources_expiration_after_effective'
      and conrelid = 'public.resources'::regclass
  ) then
    alter table public.resources
    add constraint resources_expiration_after_effective
    check (
      expires_at is null
      or effective_at is null
      or expires_at >= effective_at
    );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'resources_file_size_range'
      and conrelid = 'public.resources'::regclass
  ) then
    alter table public.resources
    add constraint resources_file_size_range
    check (
      file_size is null
      or file_size between 1 and 20971520
    );
  end if;
end
$$;

create table if not exists public.resource_versions (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  version_label text not null,
  bucket_id text not null,
  storage_path text not null,
  original_filename text not null,
  mime_type text,
  file_size bigint not null check (file_size between 1 and 20971520),
  author_name text not null default '',
  effective_at date,
  expires_at date,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  unique (resource_id, version_label),
  unique (bucket_id, storage_path),
  check (
    expires_at is null
    or effective_at is null
    or expires_at >= effective_at
  )
);

alter table public.resources
add column if not exists current_version_id uuid
references public.resource_versions(id) on delete set null;

create table if not exists public.document_favorites (
  resource_id uuid not null references public.resources(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (resource_id, user_id)
);

create table if not exists public.document_offline_selections (
  resource_id uuid not null references public.resources(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  selected_at timestamptz not null default timezone('utc', now()),
  primary key (resource_id, user_id)
);

create table if not exists public.document_audit_log (
  id bigint generated always as identity primary key,
  resource_id uuid references public.resources(id) on delete set null,
  version_id uuid references public.resource_versions(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists resources_search_vector_idx
on public.resources using gin (search_vector);

create index if not exists resources_category_updated_at_idx
on public.resources (category, updated_at desc);

create index if not exists resources_expires_at_idx
on public.resources (expires_at)
where expires_at is not null;

create index if not exists resource_versions_resource_created_at_idx
on public.resource_versions (resource_id, created_at desc);

create index if not exists document_audit_resource_created_at_idx
on public.document_audit_log (resource_id, created_at desc);

create or replace function private.refresh_resource_search_vector()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_vector :=
    setweight(
      to_tsvector('french', coalesce(new.title, '')),
      'A'
    )
    ||
    setweight(
      to_tsvector('french', coalesce(new.author_name, '')),
      'B'
    )
    ||
    setweight(
      to_tsvector('french', coalesce(array_to_string(new.tags, ' '), '')),
      'B'
    )
    ||
    setweight(
      to_tsvector('french', coalesce(new.original_filename, '')),
      'C'
    );

  return new;
end;
$$;

revoke all on function private.refresh_resource_search_vector() from public;

drop trigger if exists resources_refresh_search_vector on public.resources;
create trigger resources_refresh_search_vector
before insert or update of title, author_name, tags, original_filename
on public.resources
for each row execute function private.refresh_resource_search_vector();

update public.resources
set
  bucket_id = coalesce(
    bucket_id,
    case category
      when 'SDIS78' then 'sdis78-documents'
      when 'LECTURES' then 'lectures-documents'
      else 'resources'
    end
  ),
  current_storage_path = coalesce(current_storage_path, file_url),
  original_filename = coalesce(original_filename, title),
  updated_at = coalesce(updated_at, created_at);

alter table public.resource_versions enable row level security;
alter table public.document_favorites enable row level security;
alter table public.document_offline_selections enable row level security;
alter table public.document_audit_log enable row level security;

drop policy if exists "resource_versions_select_authenticated"
on public.resource_versions;
create policy "resource_versions_select_authenticated"
on public.resource_versions
for select
to authenticated
using (true);

drop policy if exists "document_favorites_select_own"
on public.document_favorites;
create policy "document_favorites_select_own"
on public.document_favorites
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "document_offline_selections_select_own"
on public.document_offline_selections;
create policy "document_offline_selections_select_own"
on public.document_offline_selections
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "document_audit_log_select_admin"
on public.document_audit_log;
create policy "document_audit_log_select_admin"
on public.document_audit_log
for select
to authenticated
using ((select private.is_admin()));

drop policy if exists "resources_insert_admin_only" on public.resources;
drop policy if exists "resources_update_admin_only" on public.resources;
drop policy if exists "resources_delete_admin_only" on public.resources;

revoke all on public.resources from anon, authenticated;
revoke all on public.resource_versions from anon, authenticated;
revoke all on public.document_favorites from anon, authenticated;
revoke all on public.document_offline_selections from anon, authenticated;
revoke all on public.document_audit_log from anon, authenticated;

grant select on public.resources to authenticated;
grant select on public.resource_versions to authenticated;
grant select on public.document_favorites to authenticated;
grant select on public.document_offline_selections to authenticated;
grant select on public.document_audit_log to authenticated;

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
    or p_storage_path like '%..%' then
    raise exception 'Chemin de stockage invalide';
  end if;

  if p_file_size < 1 or p_file_size > 20971520 then
    raise exception 'La taille du document doit être comprise entre 1 octet et 20 Mo';
  end if;
end;
$$;

revoke all on function private.validate_document_storage(text, text, bigint)
from public;

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

  if not (select private.is_admin()) then
    raise exception 'Action réservée aux responsables';
  end if;

  if nullif(trim(p_title), '') is null then
    raise exception 'Le titre du document est requis';
  end if;

  if p_category not in (
    'SDIS78',
    'GDO_GTO',
    'LECTURES',
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

  perform private.validate_document_storage(
    p_bucket_id,
    p_storage_path,
    p_file_size
  );

  insert into public.resources (
    id,
    title,
    category,
    file_url,
    bucket_id,
    current_storage_path,
    version_label,
    author_name,
    tags,
    effective_at,
    expires_at,
    original_filename,
    mime_type,
    file_size,
    updated_at,
    updated_by
  )
  values (
    new_resource_id,
    trim(p_title),
    p_category,
    '/app/resources/' || new_resource_id::text,
    p_bucket_id,
    p_storage_path,
    trim(p_version_label),
    coalesce(trim(p_author_name), ''),
    coalesce(p_tags, '{}'),
    p_effective_at,
    p_expires_at,
    p_original_filename,
    p_mime_type,
    p_file_size,
    timezone('utc', now()),
    current_user_id
  );

  insert into public.resource_versions (
    resource_id,
    version_label,
    bucket_id,
    storage_path,
    original_filename,
    mime_type,
    file_size,
    author_name,
    effective_at,
    expires_at,
    uploaded_by
  )
  values (
    new_resource_id,
    trim(p_version_label),
    p_bucket_id,
    p_storage_path,
    p_original_filename,
    p_mime_type,
    p_file_size,
    coalesce(trim(p_author_name), ''),
    p_effective_at,
    p_expires_at,
    current_user_id
  )
  returning id into new_version_id;

  update public.resources
  set current_version_id = new_version_id
  where id = new_resource_id;

  insert into public.document_audit_log (
    resource_id,
    version_id,
    actor_id,
    action,
    details
  )
  values (
    new_resource_id,
    new_version_id,
    current_user_id,
    'document.created',
    jsonb_build_object(
      'category', p_category,
      'version', trim(p_version_label)
    )
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

  if not (select private.is_admin()) then
    raise exception 'Action réservée aux responsables';
  end if;

  if nullif(trim(p_version_label), '') is null then
    raise exception 'La version du document est requise';
  end if;

  if p_expires_at is not null
    and p_effective_at is not null
    and p_expires_at < p_effective_at then
    raise exception 'La date d’expiration doit suivre la date d’effet';
  end if;

  perform private.validate_document_storage(
    p_bucket_id,
    p_storage_path,
    p_file_size
  );

  select *
  into target_resource
  from public.resources
  where id = p_resource_id
  for update;

  if not found then
    raise exception 'Document introuvable';
  end if;

  insert into public.resource_versions (
    resource_id,
    version_label,
    bucket_id,
    storage_path,
    original_filename,
    mime_type,
    file_size,
    author_name,
    effective_at,
    expires_at,
    uploaded_by
  )
  values (
    p_resource_id,
    trim(p_version_label),
    p_bucket_id,
    p_storage_path,
    p_original_filename,
    p_mime_type,
    p_file_size,
    coalesce(trim(p_author_name), target_resource.author_name),
    p_effective_at,
    p_expires_at,
    current_user_id
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
    resource_id,
    version_id,
    actor_id,
    action,
    details
  )
  values (
    p_resource_id,
    new_version_id,
    current_user_id,
    'document.version_added',
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

  if not (select private.is_admin()) then
    raise exception 'Action réservée aux responsables';
  end if;

  if nullif(trim(p_title), '') is null then
    raise exception 'Le titre du document est requis';
  end if;

  if p_category not in (
    'SDIS78',
    'GDO_GTO',
    'LECTURES',
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

  insert into public.document_audit_log (
    resource_id,
    actor_id,
    action,
    details
  )
  values (
    p_resource_id,
    current_user_id,
    'document.metadata_updated',
    jsonb_build_object('category', p_category)
  );
end;
$$;

create or replace function public.search_documents(
  p_query text default null,
  p_category text default null,
  p_tag text default null,
  p_favorites_only boolean default false,
  p_expiration_state text default 'all',
  p_resource_id uuid default null
)
returns table (
  id uuid,
  title text,
  category text,
  tags text[],
  version_label text,
  author_name text,
  effective_at date,
  expires_at date,
  original_filename text,
  mime_type text,
  file_size bigint,
  bucket_id text,
  storage_path text,
  updated_at timestamptz,
  is_favorite boolean,
  is_offline_selected boolean,
  version_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_query text := nullif(trim(p_query), '');
begin
  if current_user_id is null then
    raise exception 'Authentification requise';
  end if;

  if p_expiration_state not in ('all', 'valid', 'expiring', 'expired') then
    raise exception 'Filtre d’expiration invalide';
  end if;

  return query
  select
    resource.id,
    resource.title,
    resource.category,
    resource.tags,
    resource.version_label,
    resource.author_name,
    resource.effective_at,
    resource.expires_at,
    resource.original_filename,
    resource.mime_type,
    resource.file_size,
    resource.bucket_id,
    resource.current_storage_path,
    resource.updated_at,
    favorite.resource_id is not null,
    offline_selection.resource_id is not null,
    (
      select count(*)::integer
      from public.resource_versions as version
      where version.resource_id = resource.id
    )
  from public.resources as resource
  left join public.document_favorites as favorite
    on favorite.resource_id = resource.id
    and favorite.user_id = current_user_id
  left join public.document_offline_selections as offline_selection
    on offline_selection.resource_id = resource.id
    and offline_selection.user_id = current_user_id
  where (p_resource_id is null or resource.id = p_resource_id)
    and (p_category is null or resource.category = p_category)
    and (p_tag is null or p_tag = any(resource.tags))
    and (not p_favorites_only or favorite.resource_id is not null)
    and (
      normalized_query is null
      or resource.search_vector @@ websearch_to_tsquery('french', normalized_query)
    )
    and (
      p_expiration_state = 'all'
      or (
        p_expiration_state = 'valid'
        and (
          resource.expires_at is null
          or resource.expires_at > current_date + 30
        )
      )
      or (
        p_expiration_state = 'expiring'
        and resource.expires_at between current_date and current_date + 30
      )
      or (
        p_expiration_state = 'expired'
        and resource.expires_at < current_date
      )
    )
  order by
    case
      when normalized_query is null then 0
      else ts_rank(
        resource.search_vector,
        websearch_to_tsquery('french', normalized_query)
      )
    end desc,
    resource.updated_at desc,
    resource.title;
end;
$$;

create or replace function public.list_document_versions(p_resource_id uuid)
returns table (
  id uuid,
  version_label text,
  bucket_id text,
  storage_path text,
  original_filename text,
  mime_type text,
  file_size bigint,
  author_name text,
  effective_at date,
  expires_at date,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentification requise';
  end if;

  return query
  select
    version.id,
    version.version_label,
    version.bucket_id,
    version.storage_path,
    version.original_filename,
    version.mime_type,
    version.file_size,
    version.author_name,
    version.effective_at,
    version.expires_at,
    version.created_at
  from public.resource_versions as version
  where version.resource_id = p_resource_id
  order by version.created_at desc, version.id;
end;
$$;

create or replace function public.toggle_document_favorite(p_resource_id uuid)
returns boolean
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

  if exists (
    select 1
    from public.document_favorites
    where resource_id = p_resource_id
      and user_id = current_user_id
  ) then
    delete from public.document_favorites
    where resource_id = p_resource_id
      and user_id = current_user_id;
    return false;
  end if;

  insert into public.document_favorites (resource_id, user_id)
  values (p_resource_id, current_user_id);
  return true;
end;
$$;

create or replace function public.set_document_offline_selected(
  p_resource_id uuid,
  p_selected boolean
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

  if p_selected then
    insert into public.document_offline_selections (resource_id, user_id)
    values (p_resource_id, current_user_id)
    on conflict (resource_id, user_id) do update
    set selected_at = timezone('utc', now());
  else
    delete from public.document_offline_selections
    where resource_id = p_resource_id
      and user_id = current_user_id;
  end if;
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
revoke all on function public.search_documents(
  text, text, text, boolean, text, uuid
) from public, anon;
revoke all on function public.list_document_versions(uuid) from public, anon;
revoke all on function public.toggle_document_favorite(uuid) from public, anon;
revoke all on function public.set_document_offline_selected(uuid, boolean)
from public, anon;

grant execute on function public.create_document(
  text, text, text[], text, text, date, date, text, text, text, text, bigint
) to authenticated;
grant execute on function public.register_document_version(
  uuid, text, text, date, date, text, text, text, text, bigint
) to authenticated;
grant execute on function public.update_document_metadata(
  uuid, text, text, text[], text, date, date
) to authenticated;
grant execute on function public.search_documents(
  text, text, text, boolean, text, uuid
) to authenticated;
grant execute on function public.list_document_versions(uuid) to authenticated;
grant execute on function public.toggle_document_favorite(uuid) to authenticated;
grant execute on function public.set_document_offline_selected(uuid, boolean)
to authenticated;
