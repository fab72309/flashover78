alter table public.main_courantes
  add column if not exists lieu_formation text,
  add column if not exists lieu_formation_autre text,
  add column if not exists type_bruleage text,
  add column if not exists type_bruleage_autre text;

alter table public.main_courantes
  drop constraint if exists main_courantes_lieu_formation_check,
  drop constraint if exists main_courantes_lieu_formation_autre_check,
  drop constraint if exists main_courantes_type_bruleage_check,
  drop constraint if exists main_courantes_type_bruleage_autre_check;

alter table public.main_courantes
  add constraint main_courantes_lieu_formation_check
  check (
    lieu_formation is null
    or lieu_formation in (
      'MLB TdL / FO',
      'MLB TdL',
      'MLB FO',
      'MLB MaF',
      'Friche batimentaire',
      'Autre :'
    )
  ),
  add constraint main_courantes_lieu_formation_autre_check
  check (
    lieu_formation is null
    or lieu_formation not in ('Friche batimentaire', 'Autre :')
    or length(trim(coalesce(lieu_formation_autre, ''))) > 0
  ),
  add constraint main_courantes_type_bruleage_check
  check (
    type_bruleage is null
    or type_bruleage in (
      'Observation/attaque de l’extérieur',
      'Observation de l’intérieur',
      'Tableau de bord',
      'MEA',
      'Progression / Attaque',
      'Feux réels'
    )
  ),
  add constraint main_courantes_type_bruleage_autre_check
  check (
    type_bruleage is distinct from 'Feux réels'
    or length(trim(coalesce(type_bruleage_autre, ''))) > 0
  );

comment on column public.main_courantes.lieu_formation is
  'Lieu détaillé repris du suivi médical du formateur';
comment on column public.main_courantes.type_bruleage is
  'Type de brûlage repris du suivi médical du formateur';

grant insert (
  lieu_formation,
  lieu_formation_autre,
  type_bruleage,
  type_bruleage_autre
) on public.main_courantes to authenticated;
