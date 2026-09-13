alter table public.main_courantes
  drop constraint if exists main_courantes_formateur_assignments_check;

alter table public.main_courantes
  add constraint main_courantes_formateur_assignments_check
  check (
    cardinality(formateurs) = cardinality(formateur_roles)
    and formateur_roles <@ array['', 'RSFR', 'FOR INC', 'FOR BAT']::text[]
  );
