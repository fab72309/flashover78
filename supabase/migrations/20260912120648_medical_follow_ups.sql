create table if not exists public.medical_follow_ups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  nom_formateur text not null check (length(trim(nom_formateur)) > 0),
  prenom_formateur text not null check (length(trim(prenom_formateur)) > 0),
  email_formateur text not null check (length(trim(email_formateur)) > 3),
  date_formation date not null,
  journee text check (journee is null or journee in ('Matin', 'Après-Midi')),
  conditions_meteo text not null check (conditions_meteo in ('Pluie', 'Soleil', 'Couvert', 'Neige')),
  temperature text,
  hydratation_avant_bruleage text not null check (hydratation_avant_bruleage in ('0 l', '0,5 l', '1 l', '1,5 l', '2 l', '2,5 l')),
  hydratation_apres_bruleage text not null check (hydratation_apres_bruleage in ('0 l', '0,5 l', '1 l', '1,5 l', '2 l', '2,5 l')),
  lieu_formation text not null check (lieu_formation in ('MLB', 'PSY', 'Friche batimentaire', 'Autre :')),
  lieu_formation_autre text
    check (lieu_formation <> 'Autre :' or length(trim(coalesce(lieu_formation_autre, ''))) > 0),
  formation text not null check (formation in ('FI', 'FAE', 'FMPA GPT/CIS', 'Feux réels', 'FMPA Formateurs', 'Autre :')),
  formation_autre text
    check (formation <> 'Autre :' or length(trim(coalesce(formation_autre, ''))) > 0),
  role_formateur text not null check (role_formateur in ('Formateur n°1', 'Formateur n°2', 'Formateur n°3', 'Formateur n°4', 'Autre :')),
  role_formateur_autre text
    check (role_formateur <> 'Autre :' or length(trim(coalesce(role_formateur_autre, ''))) > 0),
  type_bruleage text not null check (type_bruleage in ('Observation/attaque de l’extérieur', 'Observation de l’intérieur', 'Tableau de bord', 'MEA', 'Progression / Attaque', 'Feux réels')),
  type_bruleage_autre text
    check (type_bruleage <> 'Feux réels' or length(trim(coalesce(type_bruleage_autre, ''))) > 0),
  temps_ari text not null check (temps_ari in ('30', '60', '90')),
  decontamination_post_bruleage text not null check (decontamination_post_bruleage in ('OUI', 'NON')),
  douche_dans_heure text not null check (douche_dans_heure in ('Oui', 'Non')),
  observations_post_bruleage text[] not null default '{}'
    check (
      cardinality(observations_post_bruleage) > 0
      and observations_post_bruleage <@ array[
        'Rien à signaler',
        'Céphalées',
        'Vertiges',
        'PC',
        'Douleurs Thoraciques',
        'Nausées',
        'Douleurs abdominales',
        'Fatigue',
        'Trouble du sommeil',
        'Stress / anxiété',
        'Syndrome infectieux',
        'Traitement en cours',
        'Autre :'
      ]::text[]
    ),
  observations_post_bruleage_autre text
    check (
      not ('Autre :' = any(observations_post_bruleage))
      or length(trim(coalesce(observations_post_bruleage_autre, ''))) > 0
    ),
  observations text,
  email_status text not null default 'pending'
    check (email_status in ('pending', 'sent', 'failed')),
  email_sent_at timestamptz,
  email_provider_id text,
  email_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists medical_follow_ups_user_created_at
on public.medical_follow_ups (user_id, created_at desc);

alter table public.medical_follow_ups enable row level security;

drop policy if exists "medical_follow_ups_select_own" on public.medical_follow_ups;
create policy "medical_follow_ups_select_own"
on public.medical_follow_ups
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "medical_follow_ups_insert_own" on public.medical_follow_ups;
create policy "medical_follow_ups_insert_own"
on public.medical_follow_ups
for insert
to authenticated
with check ((select auth.uid()) = user_id);

revoke all on public.medical_follow_ups from anon, authenticated;
grant select, insert on public.medical_follow_ups to authenticated;

create or replace function private.enforce_medical_follow_up_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_email text;
  profile_first_name text;
  profile_last_name text;
  profile_display_name text;
begin
  if current_user_id is null or new.user_id is distinct from current_user_id then
    raise exception 'Le suivi médical doit appartenir à l’utilisateur connecté';
  end if;

  select
    auth_user.email,
    profile.first_name,
    profile.last_name,
    profile.display_name
  into
    current_email,
    profile_first_name,
    profile_last_name,
    profile_display_name
  from auth.users as auth_user
  left join public.profiles as profile on profile.id = auth_user.id
  where auth_user.id = current_user_id;

  if current_email is null then
    raise exception 'Compte utilisateur introuvable';
  end if;

  new.email_formateur := current_email;
  new.prenom_formateur := coalesce(
    nullif(trim(profile_first_name), ''),
    nullif(trim(split_part(profile_display_name, ' ', 1)), ''),
    nullif(trim(new.prenom_formateur), '')
  );
  new.nom_formateur := coalesce(
    nullif(trim(profile_last_name), ''),
    case
      when position(' ' in trim(coalesce(profile_display_name, ''))) > 0
        then nullif(trim(substr(
          trim(profile_display_name),
          position(' ' in trim(profile_display_name)) + 1
        )), '')
      else null
    end,
    nullif(trim(new.nom_formateur), '')
  );

  if new.prenom_formateur is null or new.nom_formateur is null then
    raise exception 'Nom et prénom du formateur introuvables dans le compte';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_medical_follow_up_owner() from public;

drop trigger if exists medical_follow_ups_enforce_owner on public.medical_follow_ups;
create trigger medical_follow_ups_enforce_owner
before insert on public.medical_follow_ups
for each row execute function private.enforce_medical_follow_up_owner();
