-- Preserve medical records, operational forms and audit attribution when an
-- account is deleted. The Edge preflight is only UX; these foreign keys also
-- protect direct Auth/profile deletion and races after the preflight.
-- No rows are deleted, rewritten or anonymised. Replaying is safe.
begin;

alter table public.medical_follow_ups
  drop constraint if exists medical_follow_ups_user_id_fkey,
  add constraint medical_follow_ups_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete restrict;

alter table public.main_courantes
  drop constraint if exists main_courantes_user_id_fkey,
  add constraint main_courantes_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete restrict;

alter table public.equipment_repair_requests
  drop constraint if exists equipment_repair_requests_user_id_fkey,
  add constraint equipment_repair_requests_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete restrict;

alter table public.admin_operation_audit
  drop constraint if exists admin_operation_audit_actor_id_fkey,
  add constraint admin_operation_audit_actor_id_fkey
    foreign key (actor_id) references public.profiles(id) on delete restrict;

alter table public.training_audit_log
  drop constraint if exists training_audit_log_actor_id_fkey,
  add constraint training_audit_log_actor_id_fkey
    foreign key (actor_id) references public.profiles(id) on delete restrict;

alter table public.document_audit_log
  drop constraint if exists document_audit_log_actor_id_fkey,
  add constraint document_audit_log_actor_id_fkey
    foreign key (actor_id) references public.profiles(id) on delete restrict;

commit;
