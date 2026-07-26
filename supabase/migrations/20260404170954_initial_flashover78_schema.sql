create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null,
  first_name text,
  last_name text,
  phone text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  image_url text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.news_reads (
  news_id uuid not null references public.news(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (news_id, user_id)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  observations text,
  location text,
  formateurs text[] not null default '{}',
  date timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('SDIS78', 'GDO_GTO', 'LECTURES')),
  file_url text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.carpool_trips (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  driver_id uuid not null references public.profiles(id) on delete cascade,
  departure_city text not null,
  departure_label text not null,
  departure_datetime timestamptz not null,
  arrival_label text not null,
  available_seats integer not null check (available_seats >= 0),
  total_seats integer not null check (total_seats > 0),
  price_note text,
  vehicle_note text,
  luggage_note text,
  notes text,
  status text not null default 'open' check (status in ('open', 'full', 'cancelled', 'completed')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.carpool_requests (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.carpool_trips(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  seats_requested integer not null check (seats_requested > 0),
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles enable row level security;
alter table public.news enable row level security;
alter table public.news_reads enable row level security;
alter table public.events enable row level security;
alter table public.resources enable row level security;
alter table public.carpool_trips enable row level security;
alter table public.carpool_requests enable row level security;

create policy "profiles_select_authenticated" on public.profiles
for select to authenticated
using (true);

create policy "profiles_upsert_self" on public.profiles
for all to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "news_select_authenticated" on public.news
for select to authenticated
using (true);

create policy "news_insert_authenticated" on public.news
for insert to authenticated
with check (auth.uid() is not null);

create policy "news_reads_manage_self" on public.news_reads
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "events_select_authenticated" on public.events
for select to authenticated
using (true);

create policy "events_insert_authenticated" on public.events
for insert to authenticated
with check (auth.uid() is not null);

create policy "resources_select_authenticated" on public.resources
for select to authenticated
using (true);

create policy "resources_insert_authenticated" on public.resources
for insert to authenticated
with check (auth.uid() is not null);

create policy "carpool_trips_select_authenticated" on public.carpool_trips
for select to authenticated
using (true);

create policy "carpool_trips_insert_driver" on public.carpool_trips
for insert to authenticated
with check (auth.uid() = driver_id);

create policy "carpool_trips_update_driver" on public.carpool_trips
for update to authenticated
using (auth.uid() = driver_id)
with check (auth.uid() = driver_id);

create policy "carpool_requests_select_authenticated" on public.carpool_requests
for select to authenticated
using (true);

create policy "carpool_requests_insert_requester" on public.carpool_requests
for insert to authenticated
with check (auth.uid() = requester_id);

create policy "carpool_requests_update_requester_or_driver" on public.carpool_requests
for update to authenticated
using (
  auth.uid() = requester_id
  or exists (
    select 1
    from public.carpool_trips trip
    where trip.id = trip_id and trip.driver_id = auth.uid()
  )
)
with check (
  auth.uid() = requester_id
  or exists (
    select 1
    from public.carpool_trips trip
    where trip.id = trip_id and trip.driver_id = auth.uid()
  )
);

create index if not exists idx_events_date on public.events(date);
create index if not exists idx_carpool_trips_event on public.carpool_trips(event_id);
create index if not exists idx_carpool_trips_driver on public.carpool_trips(driver_id);
create index if not exists idx_carpool_requests_trip on public.carpool_requests(trip_id);
create index if not exists idx_carpool_requests_requester on public.carpool_requests(requester_id);

comment on schema public is 'Buckets to create in Supabase Storage: news-images, sdis78-documents, lectures-documents, brulage-documents, resources.';

insert into storage.buckets (id, name, public)
values
  ('news-images', 'news-images', true),
  ('sdis78-documents', 'sdis78-documents', true),
  ('lectures-documents', 'lectures-documents', true),
  ('brulage-documents', 'brulage-documents', true),
  ('resources', 'resources', true)
on conflict (id) do nothing;
