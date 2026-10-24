-- Legacy OLE containers (.doc/.ppt) can carry macros and active content that
-- the bounded ZIP/PDF checks do not inspect.  Until a quarantine/antivirus
-- service is deployed, fail closed for new catalogue objects.  Existing
-- historical objects are deliberately not modified here; inventory and
-- quarantine remain an explicitly authorized operational action.

drop policy if exists "documents_insert_contributor" on storage.objects;

create or replace function private.reject_legacy_office_approval()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if lower(new.storage_path) ~ '\.(doc|ppt)$' then
    raise exception 'Les formats Office legacy nécessitent une analyse dédiée';
  end if;
  return new;
end;
$$;

revoke all on function private.reject_legacy_office_approval() from public, anon;

drop trigger if exists document_upload_approvals_reject_legacy_office
on private.document_upload_approvals;
create trigger document_upload_approvals_reject_legacy_office
before insert or update on private.document_upload_approvals
for each row execute function private.reject_legacy_office_approval();

create or replace function private.reject_legacy_office_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if lower(new.storage_path) ~ '\.(doc|ppt)$' then
    raise exception 'Les formats Office legacy nécessitent une analyse dédiée';
  end if;
  return new;
end;
$$;

revoke all on function private.reject_legacy_office_version() from public, anon;

drop trigger if exists resource_versions_reject_legacy_office
on public.resource_versions;
create trigger resource_versions_reject_legacy_office
before insert or update of storage_path on public.resource_versions
for each row execute function private.reject_legacy_office_version();

create or replace function private.reject_legacy_office_resource()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if lower(coalesce(new.current_storage_path, '')) ~ '\.(doc|ppt)$'
     and (
       tg_op = 'INSERT'
       or new.current_storage_path is distinct from old.current_storage_path
     ) then
    raise exception 'Les références vers des formats Office legacy nécessitent une analyse dédiée';
  end if;
  return new;
end;
$$;

revoke all on function private.reject_legacy_office_resource() from public, anon;

drop trigger if exists resources_reject_legacy_office
on public.resources;
create trigger resources_reject_legacy_office
before insert or update of current_storage_path on public.resources
for each row execute function private.reject_legacy_office_resource();
