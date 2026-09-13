alter table public.main_courantes
  add column if not exists formateurs text[] not null default '{}',
  add column if not exists formateur_roles text[] not null default '{}';

alter table public.main_courantes
  drop constraint if exists main_courantes_formateur_assignments_check;

alter table public.main_courantes
  add constraint main_courantes_formateur_assignments_check
  check (
    cardinality(formateurs) = cardinality(formateur_roles)
    and formateur_roles <@ array['', 'RSFR', 'FOR INC', 'FOR BAT']::text[]
    and cardinality(array_remove(formateurs, '')) = cardinality(array_remove(formateur_roles, ''))
  );

comment on column public.main_courantes.formateurs is
  'Affectations de formateurs dans l’ordre des lignes du formulaire, avec prise en charge des lignes supplémentaires';
comment on column public.main_courantes.formateur_roles is
  'Fonction de chaque formateur, alignée avec le tableau formateurs : RSFR, FOR INC, FOR BAT ou vide';

grant insert (
  formateurs,
  formateur_roles
) on public.main_courantes to authenticated;
