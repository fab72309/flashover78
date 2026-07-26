alter table public.resources
drop constraint if exists resources_category_check;

alter table public.resources
add constraint resources_category_check
check (
  category in (
    'SDIS78',
    'GDO_GTO',
    'LECTURES',
    'AUTRE',
    'BRULAGE_TDL_FO',
    'BRULAGE_MAF'
  )
);

create or replace function public.create_document(
  p_title text,
  p_category text,
  p_bucket_id text,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_file_size bigint,
  p_version_label text,
  p_author_name text,
  p_tags text[],
  p_effective_at date,
  p_expires_at date
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
    updated_by
  ) values (
    new_resource_id,
    trim(p_title),
    p_category,
    '/app/resources/' || new_resource_id::text,
    p_bucket_id,
    p_storage_path,
    trim(p_version_label),
    trim(coalesce(p_author_name, '')),
    coalesce(p_tags, '{}'),
    p_effective_at,
    p_expires_at,
    p_original_filename,
    p_mime_type,
    p_file_size,
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
  ) values (
    new_resource_id,
    trim(p_version_label),
    p_bucket_id,
    p_storage_path,
    p_original_filename,
    p_mime_type,
    p_file_size,
    trim(coalesce(p_author_name, '')),
    p_effective_at,
    p_expires_at,
    current_user_id
  ) returning id into new_version_id;

  update public.resources
  set current_version_id = new_version_id
  where id = new_resource_id;

  insert into public.document_audit_log (resource_id, version_id, actor_id, action, details)
  values (new_resource_id, new_version_id, current_user_id, 'created', jsonb_build_object('category', p_category));

  return new_resource_id;
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
    author_name = trim(coalesce(p_author_name, '')),
    effective_at = p_effective_at,
    expires_at = p_expires_at,
    updated_at = timezone('utc', now()),
    updated_by = current_user_id
  where id = p_resource_id;

  if not found then
    raise exception 'Document introuvable';
  end if;

  insert into public.document_audit_log (resource_id, actor_id, action, details)
  values (p_resource_id, current_user_id, 'metadata_updated', jsonb_build_object('category', p_category));
end;
$$;
