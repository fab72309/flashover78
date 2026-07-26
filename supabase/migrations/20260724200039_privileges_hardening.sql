revoke all on public.profiles from anon, authenticated;
revoke all on public.profile_directory from anon, authenticated;
revoke all on public.events from anon, authenticated;
revoke all on public.resources from anon, authenticated;
revoke all on public.carpool_trips from anon, authenticated;
revoke all on public.carpool_requests from anon, authenticated;

grant select on public.profiles to authenticated;
grant select on public.profile_directory to authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.resources to authenticated;
grant select, insert on public.carpool_trips to authenticated;
grant select on public.carpool_requests to authenticated;

revoke all on function public.sync_my_profile(text, text, text, text) from anon;
revoke all on function public.create_carpool_request(uuid, integer, text) from anon;
revoke all on function public.respond_to_carpool_request(uuid, text) from anon;
revoke all on function public.cancel_carpool_request(uuid) from anon;
revoke all on function public.cancel_carpool_trip(uuid) from anon;
revoke all on function public.get_carpool_contacts(uuid) from anon;

drop policy if exists "carpool_trips_insert_driver" on public.carpool_trips;
create policy "carpool_trips_insert_driver"
on public.carpool_trips
for insert
to authenticated
with check ((select auth.uid()) = driver_id);

revoke all on storage.objects from anon;
