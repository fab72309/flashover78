alter table public.profiles
add column if not exists trainer_levels text[] not null default array['RSFR']::text[];

update public.profiles
set trainer_levels = array['RSFR']::text[]
where trainer_levels is null
   or cardinality(trainer_levels) = 0;

alter table public.profiles
drop constraint if exists profiles_trainer_levels_check;

alter table public.profiles
add constraint profiles_trainer_levels_check
check (
  cardinality(trainer_levels) > 0
  and trainer_levels <@ array['RSFR', 'FOR INC', 'FOR BAT']::text[]
);

alter table public.profile_directory
add column if not exists trainer_levels text[] not null default array['RSFR']::text[];

update public.profile_directory as directory
set trainer_levels = profile.trainer_levels
from public.profiles as profile
where profile.id = directory.id;

alter table public.events
add column if not exists formateur_ids uuid[] not null default '{}'::uuid[];

alter table public.events
add column if not exists formateur_levels text[] not null default '{}'::text[];

alter table public.events
drop constraint if exists events_formateur_assignments_check;

alter table public.events
add constraint events_formateur_assignments_check
check (
  cardinality(formateur_ids) = cardinality(formateur_levels)
  and cardinality(formateur_ids) <= 8
  and formateur_levels <@ array['RSFR', 'FOR INC', 'FOR BAT']::text[]
);

create or replace function private.sync_profile_directory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profile_directory (
    id,
    display_name,
    first_name,
    last_name,
    trainer_levels
  )
  values (
    new.id,
    new.display_name,
    new.first_name,
    new.last_name,
    new.trainer_levels
  )
  on conflict (id) do update
  set
    display_name = excluded.display_name,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    trainer_levels = excluded.trainer_levels,
    updated_at = timezone('utc', now());

  return new;
end;
$$;

revoke all on function private.sync_profile_directory() from public;

drop trigger if exists profiles_sync_directory on public.profiles;
create trigger profiles_sync_directory
after insert or update of display_name, first_name, last_name, trainer_levels on public.profiles
for each row execute function private.sync_profile_directory();

create or replace function private.validate_event_formateurs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.formateur_ids is not distinct from old.formateur_ids
     and new.formateur_levels is not distinct from old.formateur_levels then
    return new;
  end if;

  if cardinality(new.formateur_ids) <> cardinality(new.formateur_levels) then
    raise exception 'Les formateurs et leurs fonctions doivent être renseignés ensemble';
  end if;

  if cardinality(new.formateur_ids) > 8 then
    raise exception 'Un événement ne peut pas comporter plus de 8 formateurs';
  end if;

  if exists (
    select 1
    from (
      select assignment.trainer_level, count(*)::integer as assignment_count
      from unnest(new.formateur_ids, new.formateur_levels)
        as assignment(formateur_id, trainer_level)
      group by assignment.trainer_level
    ) as grouped_assignments
    where (grouped_assignments.trainer_level = 'RSFR' and grouped_assignments.assignment_count > 2)
       or (grouped_assignments.trainer_level = 'FOR INC' and grouped_assignments.assignment_count > 2)
       or (grouped_assignments.trainer_level = 'FOR BAT' and grouped_assignments.assignment_count > 4)
  ) then
    raise exception 'Les limites de formateurs sont de 2 RSFR, 2 FOR INC et 4 FOR BAT';
  end if;

  if cardinality(new.formateur_ids) <> (
    select count(distinct assignment.formateur_id)::integer
    from unnest(new.formateur_ids, new.formateur_levels)
      as assignment(formateur_id, trainer_level)
  ) then
    raise exception 'Un même utilisateur ne peut être affecté plusieurs fois au même événement';
  end if;

  if exists (
    select 1
    from unnest(new.formateur_ids, new.formateur_levels)
      as assignment(formateur_id, trainer_level)
    left join public.profiles as profile
      on profile.id = assignment.formateur_id
    where profile.id is null
       or not coalesce(assignment.trainer_level = any(profile.trainer_levels), false)
  ) then
    raise exception 'Chaque formateur doit disposer de la fonction sélectionnée';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_event_formateurs() from public;

drop trigger if exists events_validate_formateurs on public.events;
create trigger events_validate_formateurs
before insert or update of formateur_ids, formateur_levels on public.events
for each row execute function private.validate_event_formateurs();
