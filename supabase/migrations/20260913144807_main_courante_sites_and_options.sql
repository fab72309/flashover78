alter table public.main_courantes
  add column if not exists formation_autre text,
  add column if not exists legacy_options boolean not null default false;

-- Les anciennes mains courantes restent consultables, mais cette colonne ne
-- peut pas être renseignée par le rôle authenticated (le droit INSERT est
-- accordé explicitement colonne par colonne ci-dessous).
update public.main_courantes
set legacy_options = true
where site_formation = 'Poissy'
   or type_session in (
     '1/2 journée TdL',
     '1/2 journée FO',
     'Journée TdL / FO',
     '1/2 journée Progression',
     'Journée Progression',
     'Journée MEA'
   )
   or formation in (
     'FI SPV',
     'FI SPP',
     'FAE CE',
     'FMPA',
     'MEA',
     'FMPA Formateur',
     'Formation de formateurs'
   );

comment on column public.main_courantes.legacy_options is
  'Conserve les valeurs historiques retirées du formulaire sans les autoriser dans les nouvelles insertions';

alter table public.main_courantes
  drop constraint if exists main_courantes_site_formation_check,
  drop constraint if exists main_courantes_type_session_check,
  drop constraint if exists main_courantes_formation_check,
  drop constraint if exists main_courantes_formation_autre_check;

alter table public.main_courantes
  add constraint main_courantes_site_formation_check
  check (
    legacy_options
    or site_formation in ('Montigny le Bretonneux', 'Feux réels en friche bâtimentaire')
  ),
  add constraint main_courantes_type_session_check
  check (
    type_session is null
    or legacy_options
    or type_session in (
      'Journée complète',
      'Matin',
      'Après-Midi',
      'FI',
      'FAE',
      'FMA',
      'FMA formateurs'
    )
  ),
  add constraint main_courantes_formation_check
  check (
    formation is null
    or legacy_options
    or formation in (
      'FI',
      'FAE',
      'FMPA GPT/CIS',
      'Feux réels',
      'FMPA Formateurs',
      'Autre :'
    )
  ),
  add constraint main_courantes_formation_autre_check
  check (
    legacy_options
    or formation is distinct from 'Autre :'
    or length(trim(coalesce(formation_autre, ''))) > 0
  );

revoke insert (legacy_options) on public.main_courantes from authenticated;
grant insert (formation_autre) on public.main_courantes to authenticated;
