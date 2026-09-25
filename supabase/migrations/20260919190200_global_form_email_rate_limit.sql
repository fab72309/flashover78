-- A per-user quota is not sufficient when an attacker distributes requests
-- across accounts.  This singleton circuit breaker limits all three form
-- email workflows together.  The transaction rolls back the counter when
-- the claim or provider call fails, and the provider's own remote quota still
-- remains authoritative.

create table if not exists private.form_email_global_rate_limit (
  singleton boolean primary key default true check (singleton),
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count between 0 and 200)
);

revoke all on table private.form_email_global_rate_limit from public, anon, authenticated;

insert into private.form_email_global_rate_limit (singleton, window_started_at, request_count)
values (true, timezone('utc', now()), 0)
on conflict (singleton) do nothing;

create or replace function private.consume_form_email_global_rate_limit()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_window_started_at timestamptz;
  current_request_count integer;
begin
  select window_started_at, request_count
  into current_window_started_at, current_request_count
  from private.form_email_global_rate_limit
  where singleton
  for update;

  if not found then
    insert into private.form_email_global_rate_limit (singleton, window_started_at, request_count)
    values (true, timezone('utc', now()), 1)
    on conflict (singleton) do update
      set request_count = private.form_email_global_rate_limit.request_count + 1;
    return true;
  end if;

  if current_window_started_at <= timezone('utc', now()) - interval '1 hour' then
    update private.form_email_global_rate_limit
    set window_started_at = timezone('utc', now()), request_count = 1
    where singleton;
    return true;
  end if;

  if current_request_count >= 200 then
    return false;
  end if;

  update private.form_email_global_rate_limit
  set request_count = request_count + 1
  where singleton;
  return true;
end;
$$;

revoke all on function private.consume_form_email_global_rate_limit() from public, anon, authenticated;

create or replace function private.enforce_form_email_global_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A stale `sending` claim also changes the attempt timestamp and must count
  -- as a provider attempt.  The enclosing claim transaction rolls this back
  -- if the global limit rejects it.
  if new.email_status = 'sending' then
    if tg_op = 'INSERT'
       or old.email_status is distinct from new.email_status
       or old.email_last_attempt_at is distinct from new.email_last_attempt_at then
      if not private.consume_form_email_global_rate_limit() then
        raise exception 'Global email delivery rate limit exceeded';
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_form_email_global_rate_limit() from public, anon, authenticated;

drop trigger if exists medical_follow_ups_global_email_rate_limit
on public.medical_follow_ups;
create trigger medical_follow_ups_global_email_rate_limit
before insert or update of email_status, email_last_attempt_at on public.medical_follow_ups
for each row execute function private.enforce_form_email_global_rate_limit();

drop trigger if exists main_courantes_global_email_rate_limit
on public.main_courantes;
create trigger main_courantes_global_email_rate_limit
before insert or update of email_status, email_last_attempt_at on public.main_courantes
for each row execute function private.enforce_form_email_global_rate_limit();

drop trigger if exists equipment_repair_requests_global_email_rate_limit
on public.equipment_repair_requests;
create trigger equipment_repair_requests_global_email_rate_limit
before insert or update of email_status, email_last_attempt_at on public.equipment_repair_requests
for each row execute function private.enforce_form_email_global_rate_limit();
