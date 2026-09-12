alter table public.medical_follow_ups
add column if not exists trainer_level text;

alter table public.medical_follow_ups
drop constraint if exists medical_follow_ups_journee_check,
drop constraint if exists medical_follow_ups_lieu_formation_check,
drop constraint if exists medical_follow_ups_lieu_formation_autre_check,
drop constraint if exists medical_follow_ups_role_formateur_check,
drop constraint if exists medical_follow_ups_role_formateur_autre_check;

-- Les premières fiches ne portaient pas encore la fonction sélectionnée.
-- On conserve leur historique en reprenant le rôle existant quand il est exploitable.
update public.medical_follow_ups
set
  lieu_formation_autre = case
    when lieu_formation = 'PSY' then 'PSY'
    else lieu_formation_autre
  end,
  lieu_formation = case
    when lieu_formation = 'MLB' then 'MLB TdL / FO'
    when lieu_formation = 'PSY' then 'Autre :'
    else lieu_formation
  end,
  role_formateur = case role_formateur
    when 'Formateur n°3' then 'RSFR'
    when 'Formateur n°2' then 'FOR BAT'
    else 'FOR INC'
  end,
  role_formateur_autre = null
where true;

update public.medical_follow_ups
set trainer_level = case role_formateur
  when 'RSFR' then 'RSFR'
  when 'FOR BAT' then 'FOR BAT'
  else 'FOR INC'
end
where trainer_level is null;

update public.medical_follow_ups
set journee = 'Journée complète'
where journee is null;

alter table public.medical_follow_ups
alter column trainer_level set not null,
alter column journee set not null;

alter table public.medical_follow_ups force row level security;

alter table public.medical_follow_ups
add constraint medical_follow_ups_trainer_level_check
  check (trainer_level in ('RSFR', 'FOR INC', 'FOR BAT')),
add constraint medical_follow_ups_journee_check
  check (journee in ('Journée complète', 'Matin', 'Après-Midi')),
add constraint medical_follow_ups_lieu_formation_check
  check (lieu_formation in ('MLB TdL / FO', 'MLB TdL', 'MLB FO', 'MLB MaF', 'Friche batimentaire', 'Autre :')),
add constraint medical_follow_ups_lieu_formation_autre_check
  check (
    lieu_formation not in ('Friche batimentaire', 'Autre :')
    or length(trim(coalesce(lieu_formation_autre, ''))) > 0
  ),
add constraint medical_follow_ups_role_formateur_check
  check (role_formateur in ('RSFR', 'FOR INC', 'FOR BAT'));

create index if not exists medical_follow_ups_user_date_formation
on public.medical_follow_ups (user_id, date_formation desc, created_at desc);

drop policy if exists "medical_follow_ups_update_own" on public.medical_follow_ups;
create policy "medical_follow_ups_update_own"
on public.medical_follow_ups
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on public.medical_follow_ups from anon, authenticated;
grant select on public.medical_follow_ups to authenticated;
grant insert (
  user_id,
  trainer_level,
  nom_formateur,
  prenom_formateur,
  email_formateur,
  date_formation,
  journee,
  conditions_meteo,
  temperature,
  hydratation_avant_bruleage,
  hydratation_apres_bruleage,
  lieu_formation,
  lieu_formation_autre,
  formation,
  formation_autre,
  role_formateur,
  role_formateur_autre,
  type_bruleage,
  type_bruleage_autre,
  temps_ari,
  decontamination_post_bruleage,
  douche_dans_heure,
  observations_post_bruleage,
  observations_post_bruleage_autre,
  observations
) on public.medical_follow_ups to authenticated;
grant update (
  user_id,
  trainer_level,
  nom_formateur,
  prenom_formateur,
  email_formateur,
  date_formation,
  journee,
  conditions_meteo,
  temperature,
  hydratation_avant_bruleage,
  hydratation_apres_bruleage,
  lieu_formation,
  lieu_formation_autre,
  formation,
  formation_autre,
  role_formateur,
  role_formateur_autre,
  type_bruleage,
  type_bruleage_autre,
  temps_ari,
  decontamination_post_bruleage,
  douche_dans_heure,
  observations_post_bruleage,
  observations_post_bruleage_autre,
  observations
) on public.medical_follow_ups to authenticated;

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

  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = current_user_id
      and new.trainer_level = any(profile.trainer_levels)
  ) then
    raise exception 'La fonction sélectionnée n’est pas associée à ce compte';
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.user_id is distinct from old.user_id
       or new.trainer_level is distinct from old.trainer_level then
      raise exception 'La fiche ne peut pas être déplacée vers une autre fonction';
    end if;

    if timezone('utc', now()) > old.created_at + interval '72 hours' then
      raise exception 'La période de modification de 72 heures est dépassée';
    end if;

    new.created_at := old.created_at;
    new.email_status := 'pending';
    new.email_sent_at := null;
    new.email_provider_id := null;
    new.email_error := null;
    new.updated_at := timezone('utc', now());
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
before insert or update of
  user_id,
  trainer_level,
  nom_formateur,
  prenom_formateur,
  email_formateur,
  date_formation,
  journee,
  conditions_meteo,
  temperature,
  hydratation_avant_bruleage,
  hydratation_apres_bruleage,
  lieu_formation,
  lieu_formation_autre,
  formation,
  formation_autre,
  role_formateur,
  role_formateur_autre,
  type_bruleage,
  type_bruleage_autre,
  temps_ari,
  decontamination_post_bruleage,
  douche_dans_heure,
  observations_post_bruleage,
  observations_post_bruleage_autre,
  observations
on public.medical_follow_ups
for each row execute function private.enforce_medical_follow_up_owner();
