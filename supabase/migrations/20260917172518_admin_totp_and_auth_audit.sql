-- TOTP authorization is enforced in PostgreSQL for every existing admin policy/RPC.
-- The Auth-owned tables are read only through private, narrowly scoped definers.
create or replace function private.has_admin_mfa()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select auth.uid()) is not null
    and (select auth.jwt()->>'aal') = 'aal2'
    and (select auth.jwt()->'amr') @> '[{"method":"totp"}]'::jsonb
    and exists (
      select 1 from auth.mfa_factors as factor
      where factor.user_id = (select auth.uid())
        and factor.factor_type = 'totp' and factor.status = 'verified'
    ), false
  );
$$;

create or replace function private.has_role(p_required_role text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select auth.uid()) is not null
    and p_required_role in ('member', 'contributor', 'admin')
    and private.role_rank(private.current_role()) >= private.role_rank(p_required_role)
    and (p_required_role <> 'admin' or private.has_admin_mfa()), false
  );
$$;

-- Keep legacy policies and RPCs on the same MFA-protected admin predicate.
create or replace function private.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$ select private.has_role('admin'); $$;

create or replace function public.has_admin_mfa()
returns boolean
language sql stable security invoker
set search_path = ''
as $$ select private.has_admin_mfa(); $$;

create or replace function private.list_admin_auth_events(p_before timestamptz default null, p_before_id uuid default null)
returns table (
  id uuid, created_at timestamptz, actor_id text, actor_name text,
  action text, ip_address text
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not private.has_role('admin') then
    raise exception 'Administrator TOTP authentication required' using errcode = '42501';
  end if;
  return query
    select audit.id, audit.created_at, profile.id::text,
      profile.display_name::text, (audit.payload->>'action')::text,
      nullif(audit.ip_address, '')::text
    from auth.audit_log_entries as audit
    join public.profiles as profile on profile.id::text = audit.payload->>'actor_id'
    where profile.role = 'admin'
      and audit.created_at >= now() - interval '90 days'
      and (p_before is null or audit.created_at < p_before
        or (audit.created_at = p_before and p_before_id is not null and audit.id < p_before_id))
    order by audit.created_at desc, audit.id desc
    limit 100;
end;
$$;

create or replace function public.list_admin_auth_events(p_before timestamptz default null, p_before_id uuid default null)
returns table (
  id uuid, created_at timestamptz, actor_id text, actor_name text,
  action text, ip_address text
)
language sql stable security invoker
set search_path = ''
as $$ select * from private.list_admin_auth_events(p_before, p_before_id); $$;

revoke all on function private.has_admin_mfa() from public, anon;
revoke all on function private.has_role(text) from public, anon;
revoke all on function public.has_admin_mfa() from public, anon;
revoke all on function private.list_admin_auth_events(timestamptz, uuid) from public, anon;
revoke all on function public.list_admin_auth_events(timestamptz, uuid) from public, anon;
grant execute on function private.has_admin_mfa() to authenticated;
grant execute on function private.has_role(text) to authenticated;
grant execute on function public.has_admin_mfa() to authenticated;
grant execute on function private.list_admin_auth_events(timestamptz, uuid) to authenticated;
grant execute on function public.list_admin_auth_events(timestamptz, uuid) to authenticated;
