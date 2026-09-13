alter table public.main_courantes
  add column if not exists email_status text not null default 'pending',
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_provider_id text,
  add column if not exists email_error text;

alter table public.main_courantes
  drop constraint if exists main_courantes_email_status_check;

alter table public.main_courantes
  add constraint main_courantes_email_status_check
  check (email_status in ('pending', 'sent', 'failed'));
