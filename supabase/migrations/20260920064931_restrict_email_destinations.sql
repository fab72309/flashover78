-- Form recipients are operational configuration, not member data.  Keep the
-- authenticated grant for the admin UI/service path, but enforce the role at
-- the row-security boundary so a member cannot enumerate recipient addresses.
drop policy if exists "email_destinations_select_authenticated" on public.email_destinations;
drop policy if exists "email_destinations_select_admin" on public.email_destinations;

create policy "email_destinations_select_admin"
on public.email_destinations
for select
to authenticated
using ((select private.has_role('admin')));
