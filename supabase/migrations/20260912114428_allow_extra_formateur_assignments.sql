-- Les 2 RSFR, 2 FOR INC et 4 FOR BAT restent les emplacements initiaux de l’interface.
-- Une session peut toutefois accueillir autant de formateurs supplémentaires que nécessaire.
alter table public.events
drop constraint if exists events_formateur_assignments_check;

alter table public.events
add constraint events_formateur_assignments_check
check (
  cardinality(formateur_ids) = cardinality(formateur_levels)
  and formateur_levels <@ array['RSFR', 'FOR INC', 'FOR BAT']::text[]
);

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
