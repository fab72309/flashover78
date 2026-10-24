-- Bound collection-style RPC responses.  The frontend paginates direct
-- PostgREST lists, while these RPCs keep a defensive upper bound for direct
-- API callers.  The limits are deliberately below the server-side hard cap
-- used by the client and do not change authorization semantics.

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
  if (select auth.uid()) is null or not private.has_active_session() then
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
  order by version.created_at desc, version.id
  limit 200;
end;
$$;

create or replace function public.get_training_session_summaries(
  p_event_id uuid default null
)
returns table (
  event_id uuid,
  capacity integer,
  registered_count integer,
  waitlisted_count integer,
  my_status text,
  my_attendance text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null or not private.has_active_session() then
    raise exception 'Authentification requise';
  end if;

  return query
  select
    event.id,
    event.capacity,
    count(registration.id) filter (
      where registration.status = 'registered'
    )::integer,
    count(registration.id) filter (
      where registration.status = 'waitlisted'
    )::integer,
    max(registration.status) filter (
      where registration.user_id = current_user_id
        and registration.status <> 'cancelled'
    ),
    max(registration.attendance) filter (
      where registration.user_id = current_user_id
        and registration.status = 'registered'
    )
  from public.events as event
  left join public.training_registrations as registration
    on registration.event_id = event.id
  where p_event_id is null or event.id = p_event_id
  group by event.id, event.capacity
  order by event.id
  limit 1000;
end;
$$;

create or replace function public.get_training_session_participants(p_event_id uuid)
returns table (
  registration_id uuid,
  user_id uuid,
  display_name text,
  email text,
  phone text,
  status text,
  attendance text,
  registered_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.has_active_session() then
    raise exception 'Authentification requise';
  end if;

  if not (select private.is_admin()) then
    raise exception 'Action réservée aux responsables';
  end if;

  return query
  select
    registration.id,
    registration.user_id,
    profile.display_name,
    profile.email,
    profile.phone,
    registration.status,
    registration.attendance,
    registration.registered_at
  from public.training_registrations as registration
  join public.profiles as profile
    on profile.id = registration.user_id
  where registration.event_id = p_event_id
    and registration.status <> 'cancelled'
  order by
    case registration.status
      when 'registered' then 0
      else 1
    end,
    registration.registered_at,
    registration.id
  limit 500;
end;
$$;
