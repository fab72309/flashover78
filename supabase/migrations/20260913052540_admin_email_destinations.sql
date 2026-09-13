create table if not exists public.email_destinations (
  form_key text primary key check (form_key in ('main_courante', 'suivi_medical', 'demande_reparation')),
  recipients text[] not null default '{}'
    check (cardinality(recipients) <= 20),
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.email_destinations enable row level security;

drop policy if exists "email_destinations_select_authenticated" on public.email_destinations;
create policy "email_destinations_select_authenticated"
on public.email_destinations
for select
to authenticated
using (true);

revoke all on public.email_destinations from anon, authenticated;
grant select on public.email_destinations to authenticated;

insert into public.email_destinations (form_key, recipients)
values
  ('main_courante', array['flashover78@gmail.com']::text[]),
  ('suivi_medical', array['flashover78@gmail.com']::text[]),
  ('demande_reparation', array['flashover78@gmail.com']::text[])
on conflict (form_key) do nothing;
