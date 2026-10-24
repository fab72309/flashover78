-- Require a still-live Supabase Auth session for ordinary RLS access.
-- The previous hardening migration already protects role/RPC decisions; this
-- additive migration closes the remaining window where a revoked access token
-- could satisfy auth.uid() on a direct table or Storage read until expiry.

grant execute on function private.has_active_session() to authenticated;

alter policy "profile_directory_select_authenticated"
on public.profile_directory
using ((select private.has_active_session()));

alter policy "profiles_select_self_or_admin"
on public.profiles
using (
  (select private.has_active_session())
  and (
    id = (select auth.uid())
    or (select private.is_admin())
  )
);

alter policy "events_select_authenticated"
on public.events
using ((select private.has_active_session()));

alter policy "events_insert_contributor"
on public.events
with check (
  (select private.has_active_session())
  and (select private.has_role('contributor'))
);

alter policy "events_update_contributor"
on public.events
using (
  (select private.has_active_session())
  and (select private.has_role('contributor'))
)
with check (
  (select private.has_active_session())
  and (select private.has_role('contributor'))
);

alter policy "events_delete_admin"
on public.events
using (
  (select private.has_active_session())
  and (select private.has_role('admin'))
);

alter policy "resources_select_authenticated"
on public.resources
using ((select private.has_active_session()));

alter policy "carpool_trips_select_authenticated"
on public.carpool_trips
using ((select private.has_active_session()));

alter policy "carpool_trips_insert_driver"
on public.carpool_trips
with check (
  (select private.has_active_session())
  and (select auth.uid()) = driver_id
);

alter policy "carpool_trips_update_driver"
on public.carpool_trips
using (
  (select private.has_active_session())
  and (select auth.uid()) = driver_id
)
with check (
  (select private.has_active_session())
  and (select auth.uid()) = driver_id
);

alter policy "carpool_requests_select_involved"
on public.carpool_requests
using (
  (select private.has_active_session())
  and (
    requester_id = (select auth.uid())
    or exists (
      select 1
      from public.carpool_trips as trip
      where trip.id = carpool_requests.trip_id
        and trip.driver_id = (select auth.uid())
    )
    or (select private.is_admin())
  )
);

alter policy "carpool_posts_select_authenticated"
on public.carpool_posts
using ((select private.has_active_session()));

alter policy "carpool_matches_select_involved"
on public.carpool_matches
using (
  (select private.has_active_session())
  and (
    initiator_id = (select auth.uid())
    or exists (
      select 1
      from public.carpool_posts as offer
      where offer.id = carpool_matches.offer_post_id
        and offer.author_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.carpool_posts as need
      where need.id = carpool_matches.need_post_id
        and need.author_id = (select auth.uid())
    )
    or (select private.is_admin())
  )
);

alter policy "training_registrations_select_own_or_admin"
on public.training_registrations
using (
  (select private.has_active_session())
  and (
    user_id = (select auth.uid())
    or (select private.is_admin())
  )
);

alter policy "training_audit_log_select_admin"
on public.training_audit_log
using (
  (select private.has_active_session())
  and (select private.is_admin())
);

alter policy "resource_versions_select_authenticated"
on public.resource_versions
using ((select private.has_active_session()));

alter policy "document_favorites_select_own"
on public.document_favorites
using (
  (select private.has_active_session())
  and user_id = (select auth.uid())
);

alter policy "document_offline_selections_select_own"
on public.document_offline_selections
using (
  (select private.has_active_session())
  and user_id = (select auth.uid())
);

alter policy "document_audit_log_select_admin"
on public.document_audit_log
using (
  (select private.has_active_session())
  and (select private.is_admin())
);

alter policy "email_destinations_select_authenticated"
on public.email_destinations
using ((select private.has_active_session()));

alter policy "medical_follow_ups_select_own"
on public.medical_follow_ups
using (
  (select private.has_active_session())
  and (select auth.uid()) = user_id
);

alter policy "medical_follow_ups_insert_own"
on public.medical_follow_ups
with check (
  (select private.has_active_session())
  and (select auth.uid()) = user_id
);

alter policy "medical_follow_ups_update_own"
on public.medical_follow_ups
using (
  (select private.has_active_session())
  and (select auth.uid()) = user_id
)
with check (
  (select private.has_active_session())
  and (select auth.uid()) = user_id
);

alter policy "main_courantes_select_own"
on public.main_courantes
using (
  (select private.has_active_session())
  and (select auth.uid()) = user_id
);

alter policy "main_courantes_insert_own"
on public.main_courantes
with check (
  (select private.has_active_session())
  and (select auth.uid()) = user_id
);

alter policy "equipment_repair_requests_select_own"
on public.equipment_repair_requests
using (
  (select private.has_active_session())
  and (select auth.uid()) = user_id
);

alter policy "equipment_repair_requests_insert_own"
on public.equipment_repair_requests
with check (
  (select private.has_active_session())
  and (select auth.uid()) = user_id
);

alter policy "documents_select_authenticated"
on storage.objects
using (
  (select private.has_active_session())
  and bucket_id in (
    'sdis78-documents',
    'lectures-documents',
    'brulage-documents',
    'resources'
  )
  and (
    exists (
      select 1
      from public.resources as resource
      where resource.bucket_id = storage.objects.bucket_id
        and resource.current_storage_path = storage.objects.name
    )
    or exists (
      select 1
      from public.resource_versions as version
      where version.bucket_id = storage.objects.bucket_id
        and version.storage_path = storage.objects.name
    )
  )
);

alter policy "documents_insert_contributor"
on storage.objects
with check (
  (select private.has_active_session())
  and bucket_id in (
    'sdis78-documents',
    'lectures-documents',
    'brulage-documents',
    'resources'
  )
  and lower(name) ~ '\.(pdf|odt|doc|docx|ppt|pptx|txt)$'
  and (select private.document_storage_upload_allowed(bucket_id, name, metadata))
);

alter policy "documents_delete_unreferenced_owner"
on storage.objects
using (
  (select private.has_active_session())
  and bucket_id in (
    'sdis78-documents',
    'lectures-documents',
    'brulage-documents',
    'resources'
  )
  and (
    owner_id = (select auth.uid())::text
    or (select private.is_admin())
  )
  and not exists (
    select 1
    from public.resources as resource
    where resource.bucket_id = storage.objects.bucket_id
      and resource.current_storage_path = storage.objects.name
  )
  and not exists (
    select 1
    from public.resource_versions as version
    where version.bucket_id = storage.objects.bucket_id
      and version.storage_path = storage.objects.name
  )
);

alter policy "main_courantes_storage_select_own"
on storage.objects
using (
  (select private.has_active_session())
  and bucket_id = 'main-courantes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

alter policy "main_courantes_storage_insert_own"
on storage.objects
with check (
  (select private.pdf_storage_upload_allowed(bucket_id, name, metadata))
);

alter policy "main_courantes_storage_delete_unreferenced_own"
on storage.objects
using (
  (select private.has_active_session())
  and bucket_id = 'main-courantes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (
    select 1
    from public.main_courantes as record
    where record.user_id = (select auth.uid())
      and record.pdf_storage_path = storage.objects.name
  )
);

alter policy "equipment_repair_requests_storage_select_own"
on storage.objects
using (
  (select private.has_active_session())
  and bucket_id = 'equipment-repair-requests'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

alter policy "equipment_repair_requests_storage_insert_own"
on storage.objects
with check (
  (select private.pdf_storage_upload_allowed(bucket_id, name, metadata))
);

alter policy "equipment_repair_requests_storage_delete_unreferenced_own"
on storage.objects
using (
  (select private.has_active_session())
  and bucket_id = 'equipment-repair-requests'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (
    select 1
    from public.equipment_repair_requests as record
    where record.user_id = (select auth.uid())
      and record.pdf_storage_path = storage.objects.name
  )
);
