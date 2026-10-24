-- Persist the document section used by the Brûlage hubs.
-- The legacy heuristic remains available in the client for cached/old rows,
-- while new and migrated catalogue entries use this explicit value.

alter table public.resources
add column if not exists document_section text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'resources_document_section_check'
      and conrelid = 'public.resources'::regclass
  ) then
    alter table public.resources
    add constraint resources_document_section_check
    check (
      document_section is null
      or document_section in ('roles', 'checklists', 'references')
    );
  end if;
end;
$$;

create index if not exists resources_category_section_updated_at_idx
on public.resources (category, document_section, updated_at desc);

with brulage_documents as (
  select
    resource.id,
    lower(
      concat_ws(
        ' ',
        resource.title,
        resource.original_filename,
        array_to_string(resource.tags, ' ')
      )
    ) as search_text
  from public.resources as resource
  where resource.category in ('BRULAGE_MAF', 'BRULAGE_TDL_FO')
)
update public.resources as resource
set document_section = case
  -- Checklist is tested first because some legacy filenames contain both
  -- a role marker (FORBAT/RSFR) and the word checklist.
  when brulage.search_text like '%checklist%'
    or brulage.search_text like '%check list%'
    or brulage.search_text like '%liste de controle%'
    or brulage.search_text like '%liste de contrôle%'
    or brulage.search_text like '%liste de verification%'
    or brulage.search_text like '%liste de vérification%'
    or brulage.search_text like '%fiche de controle%'
    or brulage.search_text like '%fiche de contrôle%'
    or brulage.search_text like '%fiche de verification%'
    or brulage.search_text like '%fiche de vérification%'
    or brulage.search_text like '%points de controle%'
    or brulage.search_text like '%points de contrôle%'
    then 'checklists'
  when brulage.search_text like '%fiche de role%'
    or brulage.search_text like '%fiche de rôle%'
    or brulage.search_text like '%fiche role%'
    or brulage.search_text like '%fiche rôle%'
    or brulage.search_text like '%forbat%'
    or brulage.search_text like '%for bat%'
    or brulage.search_text like '%for inc%'
    or brulage.search_text like '%rsfr%'
    then 'roles'
  else 'references'
end
from brulage_documents as brulage
where resource.id = brulage.id;

update public.resources
set document_section = null
where category not in ('BRULAGE_MAF', 'BRULAGE_TDL_FO')
  and document_section is not null;

create or replace function public.search_documents_with_sections(
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
  document_section text,
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
  if current_user_id is null or not private.has_active_session() then
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
    resource.document_section,
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
    resource.title
  limit 200;
end;
$$;

create or replace function public.create_document_with_section(
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
  p_file_size bigint,
  p_document_section text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_section text := nullif(lower(trim(p_document_section)), '');
  resource_id uuid;
begin
  if current_user_id is null or not private.has_active_session() then
    raise exception 'Authentification requise';
  end if;

  if p_category in ('BRULAGE_MAF', 'BRULAGE_TDL_FO') then
    if normalized_section is null
      or normalized_section not in ('roles', 'checklists', 'references') then
      raise exception 'Section de brûlage invalide';
    end if;
  else
    normalized_section := null;
  end if;

  resource_id := public.create_document(
    p_title,
    p_category,
    p_tags,
    p_version_label,
    p_author_name,
    p_effective_at,
    p_expires_at,
    p_bucket_id,
    p_storage_path,
    p_original_filename,
    p_mime_type,
    p_file_size
  );

  update public.resources
  set document_section = normalized_section
  where id = resource_id;

  insert into public.document_audit_log (
    resource_id,
    actor_id,
    action,
    details
  )
  values (
    resource_id,
    current_user_id,
    'document.section_assigned',
    jsonb_build_object('document_section', normalized_section)
  );

  return resource_id;
end;
$$;

create or replace function public.update_document_metadata_with_section(
  p_resource_id uuid,
  p_title text,
  p_category text,
  p_tags text[],
  p_author_name text,
  p_effective_at date,
  p_expires_at date,
  p_document_section text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_section text := nullif(lower(trim(p_document_section)), '');
begin
  if current_user_id is null or not private.has_active_session() then
    raise exception 'Authentification requise';
  end if;

  if p_category in ('BRULAGE_MAF', 'BRULAGE_TDL_FO') then
    if normalized_section is null
      or normalized_section not in ('roles', 'checklists', 'references') then
      raise exception 'Section de brûlage invalide';
    end if;
  else
    normalized_section := null;
  end if;

  perform public.update_document_metadata(
    p_resource_id,
    p_title,
    p_category,
    p_tags,
    p_author_name,
    p_effective_at,
    p_expires_at
  );

  update public.resources
  set document_section = normalized_section
  where id = p_resource_id;

  insert into public.document_audit_log (
    resource_id,
    actor_id,
    action,
    details
  )
  values (
    p_resource_id,
    current_user_id,
    'document.section_updated',
    jsonb_build_object('document_section', normalized_section)
  );
end;
$$;

revoke all on function public.search_documents_with_sections(
  text, text, text, boolean, text, uuid
) from public, anon;
revoke all on function public.create_document_with_section(
  text, text, text[], text, text, date, date, text, text, text, text, bigint, text
) from public, anon;
revoke all on function public.update_document_metadata_with_section(
  uuid, text, text, text[], text, date, date, text
) from public, anon;

grant execute on function public.search_documents_with_sections(
  text, text, text, boolean, text, uuid
) to authenticated;
grant execute on function public.create_document_with_section(
  text, text, text[], text, text, date, date, text, text, text, text, bigint, text
) to authenticated;
grant execute on function public.update_document_metadata_with_section(
  uuid, text, text, text[], text, date, date, text
) to authenticated;
