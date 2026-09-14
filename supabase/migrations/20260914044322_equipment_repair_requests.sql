create table if not exists public.equipment_repair_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pdf_storage_path text not null check (length(trim(pdf_storage_path)) > 0),
  pdf_filename text not null check (pdf_filename ~ '^[A-Za-z0-9._-]+\.pdf$'),
  pdf_file_size bigint not null check (pdf_file_size > 0),
  lieu_formation text not null check (
    lieu_formation in (
      'Montigny le Bretonneux',
      'Poissy',
      'Feu réel',
      'Autre :'
    )
  ),
  lieu_formation_autre text
    check (
      lieu_formation <> 'Autre :'
      or length(trim(coalesce(lieu_formation_autre, ''))) > 0
    ),
  date_demande date not null,
  email_demandeur text not null check (email_demandeur ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  demande_concerne text not null check (demande_concerne in ('Matériel', 'Habillement')),
  equipement text not null check (length(trim(equipement)) > 0),
  equipement_autre text
    check (
      equipement <> 'Autre :'
      or length(trim(coalesce(equipement_autre, ''))) > 0
    ),
  numero_inventaire text,
  probleme text not null check (length(trim(probleme)) > 0),
  nom_demandeur text not null check (length(trim(nom_demandeur)) > 0),
  email_status text not null default 'pending'
    check (email_status in ('pending', 'sent', 'failed')),
  email_sent_at timestamptz,
  email_provider_id text,
  email_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint equipment_repair_requests_equipment_check check (
    (demande_concerne = 'Matériel' and equipement in (
      'ARI',
      'PIECE FACIALE',
      'VENTILATEUR',
      'RIDEAU STOP TIRAGE',
      'LANCE',
      'TUYAUX',
      'POMPE ELECTRIQUE',
      'Autre :'
    ))
    or (demande_concerne = 'Habillement' and equipement in (
      'VESTE DE FEU',
      'SURPANTALON',
      'SVI HAUT',
      'SVI BAS',
      'CASQUE F1',
      'GANTS DE FEU',
      'Autre :'
    ))
  )
);

create index if not exists equipment_repair_requests_user_date
on public.equipment_repair_requests (user_id, date_demande desc, created_at desc);

alter table public.equipment_repair_requests enable row level security;
alter table public.equipment_repair_requests force row level security;

drop policy if exists "equipment_repair_requests_select_own" on public.equipment_repair_requests;
create policy "equipment_repair_requests_select_own"
on public.equipment_repair_requests
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "equipment_repair_requests_insert_own" on public.equipment_repair_requests;
create policy "equipment_repair_requests_insert_own"
on public.equipment_repair_requests
for insert
to authenticated
with check ((select auth.uid()) = user_id);

revoke all on public.equipment_repair_requests from anon, authenticated;
grant select on public.equipment_repair_requests to authenticated;
grant insert (
  id,
  user_id,
  pdf_storage_path,
  pdf_filename,
  pdf_file_size,
  lieu_formation,
  lieu_formation_autre,
  date_demande,
  email_demandeur,
  demande_concerne,
  equipement,
  equipement_autre,
  numero_inventaire,
  probleme,
  nom_demandeur
) on public.equipment_repair_requests to authenticated;

create or replace function private.enforce_equipment_repair_request_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_email text;
begin
  if current_user_id is null or new.user_id is distinct from current_user_id then
    raise exception 'La demande de réparation doit appartenir à l’utilisateur connecté';
  end if;

  if split_part(new.pdf_storage_path, '/', 1) <> current_user_id::text
     or split_part(new.pdf_storage_path, '/', 2) <> new.id::text then
    raise exception 'Le PDF doit appartenir à l’utilisateur connecté';
  end if;

  select auth_user.email
  into current_email
  from auth.users as auth_user
  where auth_user.id = current_user_id;

  if current_email is null then
    raise exception 'Compte utilisateur introuvable';
  end if;

  new.email_demandeur := lower(trim(current_email));
  return new;
end;
$$;

revoke all on function private.enforce_equipment_repair_request_owner() from public;

drop trigger if exists equipment_repair_requests_enforce_owner on public.equipment_repair_requests;
create trigger equipment_repair_requests_enforce_owner
before insert on public.equipment_repair_requests
for each row execute function private.enforce_equipment_repair_request_owner();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'equipment-repair-requests',
  'equipment-repair-requests',
  false,
  5242880,
  array['application/pdf']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "equipment_repair_requests_storage_select_own" on storage.objects;
create policy "equipment_repair_requests_storage_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'equipment-repair-requests'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "equipment_repair_requests_storage_insert_own" on storage.objects;
create policy "equipment_repair_requests_storage_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'equipment-repair-requests'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "equipment_repair_requests_storage_delete_own" on storage.objects;
create policy "equipment_repair_requests_storage_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'equipment-repair-requests'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
