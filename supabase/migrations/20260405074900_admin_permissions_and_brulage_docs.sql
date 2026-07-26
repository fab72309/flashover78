alter table public.profiles
add column if not exists is_admin boolean not null default false;

drop policy if exists "news_insert_authenticated" on public.news;
drop policy if exists "events_insert_authenticated" on public.events;
drop policy if exists "resources_insert_authenticated" on public.resources;

create policy "news_insert_admin_only" on public.news
for insert to authenticated
with check (
  exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid() and profile.is_admin = true
  )
);

create policy "events_insert_admin_only" on public.events
for insert to authenticated
with check (
  exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid() and profile.is_admin = true
  )
);

create policy "resources_insert_admin_only" on public.resources
for insert to authenticated
with check (
  exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid() and profile.is_admin = true
  )
);
