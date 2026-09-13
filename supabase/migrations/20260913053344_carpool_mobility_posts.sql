-- A mobility publication is the common object behind both "offer seats" and
-- "look for a ride". Matches are handled separately so several drivers can
-- answer a need before the passenger confirms one of them.

create table if not exists public.carpool_posts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('offer', 'need')),
  departure_city text not null,
  departure_label text not null,
  departure_datetime timestamptz not null,
  arrival_label text not null,
  requested_seats integer,
  available_seats integer,
  total_seats integer,
  price_note text,
  vehicle_note text,
  luggage_note text,
  notes text,
  status text not null default 'open'
    check (status in ('open', 'partially_matched', 'matched', 'completed', 'cancelled', 'expired')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint carpool_posts_shape check (
    (
      kind = 'offer'
      and requested_seats is null
      and total_seats is not null
      and total_seats > 0
      and available_seats is not null
      and available_seats between 0 and total_seats
    )
    or (
      kind = 'need'
      and requested_seats is not null
      and requested_seats > 0
      and available_seats is null
      and total_seats is null
      and price_note is null
      and vehicle_note is null
      and luggage_note is null
    )
  )
);

create table if not exists public.carpool_matches (
  id uuid primary key default gen_random_uuid(),
  offer_post_id uuid not null references public.carpool_posts(id) on delete cascade,
  need_post_id uuid not null references public.carpool_posts(id) on delete cascade,
  initiator_id uuid not null references public.profiles(id) on delete cascade,
  seats_requested integer not null check (seats_requested > 0),
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint carpool_matches_distinct_posts check (offer_post_id <> need_post_id)
);

create unique index if not exists carpool_matches_one_active_per_pair
on public.carpool_matches (offer_post_id, need_post_id)
where status in ('pending', 'accepted');

create index if not exists carpool_posts_event_datetime_idx
on public.carpool_posts (event_id, departure_datetime);

create index if not exists carpool_posts_kind_status_datetime_idx
on public.carpool_posts (kind, status, departure_datetime);

create index if not exists carpool_posts_author_datetime_idx
on public.carpool_posts (author_id, departure_datetime);

create index if not exists carpool_matches_offer_status_idx
on public.carpool_matches (offer_post_id, status);

create index if not exists carpool_matches_need_status_idx
on public.carpool_matches (need_post_id, status);

-- Preserve the existing carpool data while moving the application to the
-- unified model. A legacy full trip is a matched offer; a legacy request gets
-- its own need publication and a corresponding match.
insert into public.carpool_posts (
  id,
  event_id,
  author_id,
  kind,
  departure_city,
  departure_label,
  departure_datetime,
  arrival_label,
  requested_seats,
  available_seats,
  total_seats,
  price_note,
  vehicle_note,
  luggage_note,
  notes,
  status,
  created_at,
  updated_at
)
select
  trip.id,
  trip.event_id,
  trip.driver_id,
  'offer',
  trip.departure_city,
  trip.departure_label,
  trip.departure_datetime,
  trip.arrival_label,
  null,
  trip.available_seats,
  trip.total_seats,
  trip.price_note,
  trip.vehicle_note,
  trip.luggage_note,
  trip.notes,
  case
    when trip.status = 'cancelled' then 'cancelled'
    when trip.status = 'completed' then 'completed'
    when trip.available_seats = 0 then 'matched'
    when trip.available_seats < trip.total_seats then 'partially_matched'
    else 'open'
  end,
  trip.created_at,
  trip.created_at
from public.carpool_trips as trip
where not exists (
  select 1
  from public.carpool_posts as existing_post
  where existing_post.id = trip.id
)
on conflict (id) do nothing;

insert into public.carpool_posts (
  id,
  event_id,
  author_id,
  kind,
  departure_city,
  departure_label,
  departure_datetime,
  arrival_label,
  requested_seats,
  status,
  created_at,
  updated_at
)
select
  request.id,
  trip.event_id,
  request.requester_id,
  'need',
  trip.departure_city,
  trip.departure_label,
  trip.departure_datetime,
  trip.arrival_label,
  request.seats_requested,
  case
    when request.status = 'accepted' then 'matched'
    when request.status in ('rejected', 'cancelled') then 'cancelled'
    else 'open'
  end,
  request.created_at,
  request.created_at
from public.carpool_requests as request
join public.carpool_trips as trip on trip.id = request.trip_id
where not exists (
  select 1
  from public.carpool_posts as existing_post
  where existing_post.id = request.id
)
on conflict (id) do nothing;

insert into public.carpool_matches (
  id,
  offer_post_id,
  need_post_id,
  initiator_id,
  seats_requested,
  message,
  status,
  created_at,
  updated_at
)
select
  request.id,
  request.trip_id,
  request.id,
  request.requester_id,
  request.seats_requested,
  request.message,
  request.status,
  request.created_at,
  request.created_at
from public.carpool_requests as request
where not exists (
  select 1
  from public.carpool_matches as existing_match
  where existing_match.id = request.id
)
on conflict (id) do nothing;

create or replace function private.refresh_carpool_post_status(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_post public.carpool_posts;
  accepted_seats integer;
begin
  select *
  into target_post
  from public.carpool_posts
  where id = p_post_id;

  if not found or target_post.status in ('cancelled', 'completed', 'expired') then
    return;
  end if;

  select coalesce(sum(match.seats_requested), 0)
  into accepted_seats
  from public.carpool_matches as match
  where match.status = 'accepted'
    and (
      (target_post.kind = 'offer' and match.offer_post_id = target_post.id)
      or (target_post.kind = 'need' and match.need_post_id = target_post.id)
    );

  if target_post.kind = 'offer' then
    update public.carpool_posts
    set
      available_seats = greatest(0, target_post.total_seats - accepted_seats),
      status = case
        when greatest(0, target_post.total_seats - accepted_seats) = 0 then 'matched'
        when accepted_seats > 0 then 'partially_matched'
        else 'open'
      end,
      updated_at = timezone('utc', now())
    where id = target_post.id;
  else
    update public.carpool_posts
    set
      status = case
        when accepted_seats >= target_post.requested_seats then 'matched'
        when accepted_seats > 0 then 'partially_matched'
        else 'open'
      end,
      updated_at = timezone('utc', now())
    where id = target_post.id;
  end if;
end;
$$;

create or replace function public.create_carpool_post(
  p_event_id uuid,
  p_kind text,
  p_departure_city text,
  p_departure_label text,
  p_departure_datetime timestamptz,
  p_arrival_label text,
  p_seats integer,
  p_price_note text default null,
  p_vehicle_note text default null,
  p_luggage_note text default null,
  p_notes text default null
)
returns public.carpool_posts
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_kind text := lower(trim(coalesce(p_kind, '')));
  created_post public.carpool_posts;
begin
  if current_user_id is null then
    raise exception 'Authentification requise';
  end if;

  if normalized_kind not in ('offer', 'need') then
    raise exception 'Type de publication invalide';
  end if;

  if nullif(trim(coalesce(p_departure_city, '')), '') is null
    or nullif(trim(coalesce(p_departure_label, '')), '') is null
    or nullif(trim(coalesce(p_arrival_label, '')), '') is null then
    raise exception 'Les lieux de départ et d''arrivée sont obligatoires';
  end if;

  if p_departure_datetime is null then
    raise exception 'La date de départ est obligatoire';
  end if;

  if p_seats is null or p_seats < 1 then
    raise exception 'Le nombre de places doit être supérieur à zéro';
  end if;

  if p_event_id is not null and not exists (
    select 1 from public.events where id = p_event_id
  ) then
    raise exception 'Formation introuvable';
  end if;

  if normalized_kind = 'offer' then
    insert into public.carpool_posts (
      event_id,
      author_id,
      kind,
      departure_city,
      departure_label,
      departure_datetime,
      arrival_label,
      available_seats,
      total_seats,
      price_note,
      vehicle_note,
      luggage_note,
      notes,
      status
    )
    values (
      p_event_id,
      current_user_id,
      normalized_kind,
      trim(p_departure_city),
      trim(p_departure_label),
      p_departure_datetime,
      trim(p_arrival_label),
      p_seats,
      p_seats,
      nullif(trim(p_price_note), ''),
      nullif(trim(p_vehicle_note), ''),
      nullif(trim(p_luggage_note), ''),
      nullif(trim(p_notes), ''),
      'open'
    )
    returning * into created_post;
  else
    insert into public.carpool_posts (
      event_id,
      author_id,
      kind,
      departure_city,
      departure_label,
      departure_datetime,
      arrival_label,
      requested_seats,
      notes,
      status
    )
    values (
      p_event_id,
      current_user_id,
      normalized_kind,
      trim(p_departure_city),
      trim(p_departure_label),
      p_departure_datetime,
      trim(p_arrival_label),
      p_seats,
      nullif(trim(p_notes), ''),
      'open'
    )
    returning * into created_post;
  end if;

  return created_post;
end;
$$;

create or replace function public.request_carpool_ride(
  p_offer_post_id uuid,
  p_seats_requested integer,
  p_message text default null
)
returns public.carpool_posts
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  offer_post public.carpool_posts;
  created_need public.carpool_posts;
begin
  if current_user_id is null then
    raise exception 'Authentification requise';
  end if;

  if p_seats_requested is null or p_seats_requested < 1 then
    raise exception 'Le nombre de places doit être supérieur à zéro';
  end if;

  select * into offer_post
  from public.carpool_posts
  where id = p_offer_post_id
  for update;

  if offer_post.id is null then
    raise exception 'Offre de trajet introuvable';
  end if;

  if offer_post.kind <> 'offer'
    or offer_post.author_id = current_user_id
    or offer_post.status not in ('open', 'partially_matched')
    or offer_post.available_seats < p_seats_requested then
    raise exception 'Cette offre ne dispose pas de suffisamment de places';
  end if;

  if exists (
    select 1
    from public.carpool_matches as match
    join public.carpool_posts as need on need.id = match.need_post_id
    where match.offer_post_id = offer_post.id
      and match.initiator_id = current_user_id
      and need.author_id = current_user_id
      and match.status in ('pending', 'accepted')
  ) then
    raise exception 'Vous avez déjà une demande active sur cette offre';
  end if;

  insert into public.carpool_posts (
    event_id,
    author_id,
    kind,
    departure_city,
    departure_label,
    departure_datetime,
    arrival_label,
    requested_seats,
    notes,
    status
  )
  values (
    offer_post.event_id,
    current_user_id,
    'need',
    offer_post.departure_city,
    offer_post.departure_label,
    offer_post.departure_datetime,
    offer_post.arrival_label,
    p_seats_requested,
    nullif(trim(p_message), ''),
    'open'
  )
  returning * into created_need;

  insert into public.carpool_matches (
    offer_post_id,
    need_post_id,
    initiator_id,
    seats_requested,
    message,
    status
  )
  values (
    offer_post.id,
    created_need.id,
    current_user_id,
    p_seats_requested,
    nullif(trim(p_message), ''),
    'pending'
  );

  return created_need;
end;
$$;

create or replace function public.create_carpool_match(
  p_offer_post_id uuid,
  p_need_post_id uuid,
  p_seats_requested integer,
  p_message text default null
)
returns public.carpool_matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  offer_post public.carpool_posts;
  need_post public.carpool_posts;
  accepted_need_seats integer;
  created_match public.carpool_matches;
begin
  if current_user_id is null then
    raise exception 'Authentification requise';
  end if;

  if p_offer_post_id = p_need_post_id then
    raise exception 'Une publication ne peut pas être associée à elle-même';
  end if;

  if p_seats_requested is null or p_seats_requested < 1 then
    raise exception 'Le nombre de places doit être supérieur à zéro';
  end if;

  -- Lock both publications before checking capacity so two simultaneous
  -- acceptances cannot allocate the same seat.
  perform 1
  from public.carpool_posts
  where id in (p_offer_post_id, p_need_post_id)
  order by id
  for update;

  select * into offer_post
  from public.carpool_posts
  where id = p_offer_post_id;

  select * into need_post
  from public.carpool_posts
  where id = p_need_post_id;

  if offer_post.id is null or need_post.id is null then
    raise exception 'Publication introuvable';
  end if;

  if offer_post.kind <> 'offer' or need_post.kind <> 'need' then
    raise exception 'La correspondance doit relier une offre et un besoin';
  end if;

  if offer_post.event_id is not null
    and need_post.event_id is not null
    and offer_post.event_id <> need_post.event_id then
    raise exception 'Les publications concernent deux formations différentes';
  end if;

  if offer_post.author_id = need_post.author_id then
    raise exception 'Les deux publications appartiennent au même formateur';
  end if;

  if current_user_id <> offer_post.author_id
    and current_user_id <> need_post.author_id
    and not (select private.is_admin()) then
    raise exception 'Action non autorisée';
  end if;

  if offer_post.status not in ('open', 'partially_matched')
    or offer_post.available_seats < p_seats_requested then
    raise exception 'Cette offre ne dispose pas de suffisamment de places';
  end if;

  select coalesce(sum(match.seats_requested), 0)
  into accepted_need_seats
  from public.carpool_matches as match
  where match.need_post_id = need_post.id
    and match.status = 'accepted';

  if need_post.status in ('cancelled', 'completed', 'expired')
    or need_post.requested_seats - accepted_need_seats < p_seats_requested then
    raise exception 'Ce besoin est déjà couvert ou indisponible';
  end if;

  if exists (
    select 1
    from public.carpool_matches as match
    where match.offer_post_id = p_offer_post_id
      and match.need_post_id = p_need_post_id
      and match.status in ('pending', 'accepted')
  ) then
    raise exception 'Une correspondance est déjà en cours pour ces publications';
  end if;

  insert into public.carpool_matches (
    offer_post_id,
    need_post_id,
    initiator_id,
    seats_requested,
    message,
    status
  )
  values (
    p_offer_post_id,
    p_need_post_id,
    current_user_id,
    p_seats_requested,
    nullif(trim(p_message), ''),
    'pending'
  )
  returning * into created_match;

  return created_match;
end;
$$;

create or replace function public.respond_to_carpool_match(
  p_match_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_match public.carpool_matches;
  offer_post public.carpool_posts;
  need_post public.carpool_posts;
  accepted_need_seats integer;
  target_offer_post_id uuid;
  target_need_post_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentification requise';
  end if;

  if p_status not in ('accepted', 'rejected') then
    raise exception 'Décision invalide';
  end if;

  select match.offer_post_id, match.need_post_id
  into target_offer_post_id, target_need_post_id
  from public.carpool_matches as match
  where match.id = p_match_id;

  if target_offer_post_id is null or target_need_post_id is null then
    raise exception 'Correspondance introuvable';
  end if;

  perform 1
  from public.carpool_posts
  where id in (target_offer_post_id, target_need_post_id)
  order by id
  for update;

  select * into target_match
  from public.carpool_matches
  where id = p_match_id
  for update;

  select * into offer_post
  from public.carpool_posts
  where id = target_match.offer_post_id;

  select * into need_post
  from public.carpool_posts
  where id = target_match.need_post_id;

  if target_match.status <> 'pending' then
    raise exception 'Cette correspondance a déjà été traitée';
  end if;

  if current_user_id = target_match.initiator_id
    or (
      current_user_id <> offer_post.author_id
      and current_user_id <> need_post.author_id
      and not (select private.is_admin())
    ) then
    raise exception 'Action réservée à l''autre formateur';
  end if;

  if p_status = 'accepted' then
    if offer_post.status not in ('open', 'partially_matched')
      or offer_post.available_seats < target_match.seats_requested then
      raise exception 'Plus assez de places disponibles';
    end if;

    select coalesce(sum(match.seats_requested), 0)
    into accepted_need_seats
    from public.carpool_matches as match
    where match.need_post_id = need_post.id
      and match.status = 'accepted';

    if need_post.status in ('cancelled', 'completed', 'expired')
      or need_post.requested_seats - accepted_need_seats < target_match.seats_requested then
      raise exception 'Ce besoin est déjà couvert ou indisponible';
    end if;

    update public.carpool_matches
    set status = 'accepted', updated_at = timezone('utc', now())
    where id = target_match.id;

    perform private.refresh_carpool_post_status(offer_post.id);
    perform private.refresh_carpool_post_status(need_post.id);

    select coalesce(sum(match.seats_requested), 0)
    into accepted_need_seats
    from public.carpool_matches as match
    where match.need_post_id = need_post.id
      and match.status = 'accepted';

    if accepted_need_seats >= need_post.requested_seats then
      update public.carpool_matches
      set status = 'rejected', updated_at = timezone('utc', now())
      where need_post_id = need_post.id
        and status = 'pending'
        and id <> target_match.id;
    end if;

    if offer_post.available_seats - target_match.seats_requested <= 0 then
      update public.carpool_matches
      set status = 'rejected', updated_at = timezone('utc', now())
      where offer_post_id = offer_post.id
        and status = 'pending'
        and id <> target_match.id;
    end if;
  else
    update public.carpool_matches
    set status = 'rejected', updated_at = timezone('utc', now())
    where id = target_match.id;
  end if;
end;
$$;

create or replace function public.cancel_carpool_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_match public.carpool_matches;
  offer_post public.carpool_posts;
  need_post public.carpool_posts;
  target_offer_post_id uuid;
  target_need_post_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentification requise';
  end if;

  select offer_post_id, need_post_id
  into target_offer_post_id, target_need_post_id
  from public.carpool_matches
  where id = p_match_id;

  if target_offer_post_id is null or target_need_post_id is null then
    raise exception 'Correspondance introuvable';
  end if;

  perform 1
  from public.carpool_posts
  where id in (target_offer_post_id, target_need_post_id)
  order by id
  for update;

  select * into target_match
  from public.carpool_matches
  where id = p_match_id
  for update;

  select * into offer_post from public.carpool_posts where id = target_match.offer_post_id;
  select * into need_post from public.carpool_posts where id = target_match.need_post_id;

  if current_user_id not in (target_match.initiator_id, offer_post.author_id, need_post.author_id)
    and not (select private.is_admin()) then
    raise exception 'Action non autorisée';
  end if;

  if target_match.status = 'cancelled' then
    return;
  end if;

  update public.carpool_matches
  set status = 'cancelled', updated_at = timezone('utc', now())
  where id = target_match.id;

  if target_match.status = 'accepted' then
    perform private.refresh_carpool_post_status(offer_post.id);
    perform private.refresh_carpool_post_status(need_post.id);
  end if;
end;
$$;

create or replace function public.cancel_carpool_post(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_post public.carpool_posts;
  target_match public.carpool_matches;
  offer_post public.carpool_posts;
begin
  if current_user_id is null then
    raise exception 'Authentification requise';
  end if;

  select * into target_post
  from public.carpool_posts
  where id = p_post_id
  for update;

  if target_post.id is null
    or (target_post.author_id <> current_user_id and not (select private.is_admin())) then
    raise exception 'Publication introuvable ou action non autorisée';
  end if;

  if target_post.status = 'cancelled' then
    return;
  end if;

  for target_match in
    select *
    from public.carpool_matches
    where (offer_post_id = target_post.id or need_post_id = target_post.id)
      and status in ('pending', 'accepted')
    order by id
    for update
  loop
    if target_match.status = 'accepted' and target_post.kind = 'need' then
      select * into offer_post
      from public.carpool_posts
      where id = target_match.offer_post_id
      for update;
    end if;

    update public.carpool_matches
    set status = 'cancelled', updated_at = timezone('utc', now())
    where id = target_match.id;

    if target_match.status = 'accepted' then
      if target_post.kind = 'need' then
        perform private.refresh_carpool_post_status(offer_post.id);
      else
        perform private.refresh_carpool_post_status(target_match.need_post_id);
      end if;
    end if;
  end loop;

  update public.carpool_posts
  set status = 'cancelled', updated_at = timezone('utc', now())
  where id = target_post.id;
end;
$$;

create or replace function public.complete_carpool_post(p_post_id uuid)
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

  update public.carpool_posts
  set status = 'completed', updated_at = timezone('utc', now())
  where id = p_post_id
    and (author_id = current_user_id or (select private.is_admin()))
    and status not in ('cancelled', 'completed');

  if not found then
    raise exception 'Publication introuvable ou action non autorisée';
  end if;

  update public.carpool_matches
  set status = 'cancelled', updated_at = timezone('utc', now())
  where (offer_post_id = p_post_id or need_post_id = p_post_id)
    and status = 'pending';
end;
$$;

create or replace function public.get_carpool_post_contacts(p_post_id uuid)
returns table (
  user_id uuid,
  email text,
  phone text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentification requise';
  end if;

  if not exists (
    select 1
    from public.carpool_posts as post
    where post.id = p_post_id
      and (
        post.author_id = current_user_id
        or (select private.is_admin())
        or exists (
          select 1
          from public.carpool_matches as match
          join public.carpool_posts as offer on offer.id = match.offer_post_id
          join public.carpool_posts as need on need.id = match.need_post_id
          where match.status = 'accepted'
            and (match.offer_post_id = p_post_id or match.need_post_id = p_post_id)
            and current_user_id in (offer.author_id, need.author_id)
        )
      )
  ) then
    raise exception 'Contacts disponibles après validation uniquement';
  end if;

  return query
  select distinct profile.id, profile.email, profile.phone
  from public.profiles as profile
  where profile.id = (
    select post.author_id from public.carpool_posts as post where post.id = p_post_id
  )
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
end;
$$;

alter table public.carpool_posts enable row level security;
alter table public.carpool_matches enable row level security;

drop policy if exists "carpool_posts_select_authenticated" on public.carpool_posts;
create policy "carpool_posts_select_authenticated"
on public.carpool_posts
for select
to authenticated
using (true);

drop policy if exists "carpool_matches_select_involved" on public.carpool_matches;
create policy "carpool_matches_select_involved"
on public.carpool_matches
for select
to authenticated
using (
  initiator_id = (select auth.uid())
  or exists (
    select 1
    from public.carpool_posts as offer
    where offer.id = carpool_matches.offer_post_id
      and offer.author_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.carpool_posts as need
    where need.id = carpool_matches.need_post_id
      and need.author_id = (select auth.uid())
  )
  or (select private.is_admin())
);

revoke all on public.carpool_posts from anon, authenticated;
revoke all on public.carpool_matches from anon, authenticated;
grant select on public.carpool_posts to authenticated;
grant select on public.carpool_matches to authenticated;

revoke all on function public.create_carpool_post(uuid, text, text, text, timestamptz, text, integer, text, text, text, text) from public, anon;
revoke all on function public.request_carpool_ride(uuid, integer, text) from public, anon;
revoke all on function public.create_carpool_match(uuid, uuid, integer, text) from public, anon;
revoke all on function public.respond_to_carpool_match(uuid, text) from public, anon;
revoke all on function public.cancel_carpool_match(uuid) from public, anon;
revoke all on function public.cancel_carpool_post(uuid) from public, anon;
revoke all on function public.complete_carpool_post(uuid) from public, anon;
revoke all on function public.get_carpool_post_contacts(uuid) from public, anon;
grant execute on function public.create_carpool_post(uuid, text, text, text, timestamptz, text, integer, text, text, text, text) to authenticated;
grant execute on function public.request_carpool_ride(uuid, integer, text) to authenticated;
grant execute on function public.create_carpool_match(uuid, uuid, integer, text) to authenticated;
grant execute on function public.respond_to_carpool_match(uuid, text) to authenticated;
grant execute on function public.cancel_carpool_match(uuid) to authenticated;
grant execute on function public.cancel_carpool_post(uuid) to authenticated;
grant execute on function public.complete_carpool_post(uuid) to authenticated;
grant execute on function public.get_carpool_post_contacts(uuid) to authenticated;

revoke all on function private.refresh_carpool_post_status(uuid) from public, anon, authenticated;
