create or replace function private.validate_main_courante_formateur_assignments()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  assignment_index integer;
begin
  if cardinality(new.formateurs) <> cardinality(new.formateur_roles) then
    raise exception 'Les tableaux de formateurs doivent avoir la même longueur';
  end if;

  for assignment_index in 1..coalesce(cardinality(new.formateurs), 0) loop
    if length(trim(coalesce(new.formateurs[assignment_index], ''))) > 0
       and coalesce(new.formateur_roles[assignment_index], '') = '' then
      raise exception 'Chaque nom de formateur doit être associé à une fonction';
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function private.validate_main_courante_formateur_assignments() from public, authenticated;

drop trigger if exists main_courantes_validate_formateur_assignments on public.main_courantes;
create trigger main_courantes_validate_formateur_assignments
before insert or update on public.main_courantes
for each row execute function private.validate_main_courante_formateur_assignments();
