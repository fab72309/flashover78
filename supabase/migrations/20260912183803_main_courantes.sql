create table if not exists public.main_courantes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pdf_storage_path text not null check (length(trim(pdf_storage_path)) > 0),
  pdf_filename text not null check (pdf_filename ~ '^[A-Za-z0-9._-]+\.pdf$'),
  pdf_file_size bigint not null check (pdf_file_size > 0),
  email_formateur text not null check (length(trim(email_formateur)) > 3),
  date_main_courante date not null,
  vent smallint check (vent is null or vent between 1 and 5),
  sens_du_vent text check (sens_du_vent is null or sens_du_vent in ('Arrière', 'Avant', 'Latéral')),
  meteo text[] not null default '{}'
    check (meteo <@ array['Pluie', 'Soleil', 'Couvert', 'Neige']::text[]),
  formateur_1 text,
  formateur_2 text,
  formateur_3 text,
  formateur_4 text,
  formateur_5 text,
  site_formation text not null check (
    site_formation in ('Montigny le Bretonneux', 'Poissy', 'Feux réels en friche bâtimentaire')
  ),
  type_session text check (
    type_session is null or type_session in (
      '1/2 journée TdL',
      '1/2 journée FO',
      'Journée TdL / FO',
      '1/2 journée Progression',
      'Journée Progression',
      'Journée MEA',
      'FI',
      'FAE',
      'FMA',
      'FMA formateurs'
    )
  ),
  formation text check (
    formation is null or formation in (
      'FI SPV',
      'FI SPP',
      'FAE CE',
      'FMPA',
      'MEA',
      'FMPA Formateur',
      'Formation de formateurs'
    )
  ),
  citerne_gaz smallint check (citerne_gaz is null or citerne_gaz between 1 and 10),
  panneaux_bois smallint check (panneaux_bois is null or panneaux_bois between 1 and 10),
  palettes smallint check (palettes is null or palettes between 1 and 10),
  masques_ffp3 smallint check (masques_ffp3 is null or masques_ffp3 between 1 and 10),
  gants_nitrile smallint check (gants_nitrile is null or gants_nitrile between 1 and 10),
  benne_dechet smallint check (benne_dechet is null or benne_dechet between 1 and 5),
  chariot_foyer_demarrage text[] not null default '{}'
    check (chariot_foyer_demarrage <@ array['Vide', 'OK']::text[]),
  observations_difficultes text,
  reparations_materiel text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists main_courantes_user_date
on public.main_courantes (user_id, date_main_courante desc, created_at desc);

alter table public.main_courantes enable row level security;
alter table public.main_courantes force row level security;

drop policy if exists "main_courantes_select_own" on public.main_courantes;
create policy "main_courantes_select_own"
on public.main_courantes
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "main_courantes_insert_own" on public.main_courantes;
create policy "main_courantes_insert_own"
on public.main_courantes
for insert
to authenticated
with check ((select auth.uid()) = user_id);

revoke all on public.main_courantes from anon, authenticated;
grant select on public.main_courantes to authenticated;
grant insert (
  id,
  user_id,
  pdf_storage_path,
  pdf_filename,
  pdf_file_size,
  email_formateur,
  date_main_courante,
  vent,
  sens_du_vent,
  meteo,
  formateur_1,
  formateur_2,
  formateur_3,
  formateur_4,
  formateur_5,
  site_formation,
  type_session,
  formation,
  citerne_gaz,
  panneaux_bois,
  palettes,
  masques_ffp3,
  gants_nitrile,
  benne_dechet,
  chariot_foyer_demarrage,
  observations_difficultes,
  reparations_materiel
) on public.main_courantes to authenticated;

create or replace function private.enforce_main_courante_owner()
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
    raise exception 'La main courante doit appartenir à l’utilisateur connecté';
  end if;

  select auth_user.email
  into current_email
  from auth.users as auth_user
  where auth_user.id = current_user_id;

  if current_email is null then
    raise exception 'Compte utilisateur introuvable';
  end if;

  if split_part(new.pdf_storage_path, '/', 1) <> current_user_id::text
     or split_part(new.pdf_storage_path, '/', 2) <> new.id::text then
    raise exception 'Le PDF doit appartenir à l’utilisateur connecté';
  end if;

  new.email_formateur := current_email;
  return new;
end;
$$;

revoke all on function private.enforce_main_courante_owner() from public;

drop trigger if exists main_courantes_enforce_owner on public.main_courantes;
create trigger main_courantes_enforce_owner
before insert on public.main_courantes
for each row execute function private.enforce_main_courante_owner();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'main-courantes',
  'main-courantes',
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

drop policy if exists "main_courantes_storage_select_own" on storage.objects;
create policy "main_courantes_storage_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'main-courantes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "main_courantes_storage_insert_own" on storage.objects;
create policy "main_courantes_storage_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'main-courantes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "main_courantes_storage_delete_own" on storage.objects;
create policy "main_courantes_storage_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'main-courantes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
