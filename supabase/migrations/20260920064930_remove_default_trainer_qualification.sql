-- Trainer functions are explicit administrative qualifications.  Preserve
-- existing assignments, but do not assign RSFR to newly created profiles.
alter table public.profiles
  alter column trainer_levels set default '{}'::text[];

alter table public.profile_directory
  alter column trainer_levels set default '{}'::text[];

alter table public.profiles
  drop constraint if exists profiles_trainer_levels_check;

alter table public.profiles
  add constraint profiles_trainer_levels_check
  check (
    trainer_levels <@ array['RSFR', 'FOR INC', 'FOR BAT']::text[]
    and cardinality(trainer_levels) <= 3
  );
