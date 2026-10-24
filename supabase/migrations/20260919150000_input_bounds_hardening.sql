-- Bound the remaining direct-API text and array inputs.  NOT VALID preserves
-- historical rows while enforcing the invariant for every new or updated row;
-- production must inventory and validate the existing data separately.

alter table public.medical_follow_ups
  add constraint medical_follow_ups_input_bounds
  check (
    length(coalesce(temperature, '')) <= 32
    and length(coalesce(lieu_formation_autre, '')) <= 500
    and length(coalesce(formation_autre, '')) <= 500
    and length(coalesce(role_formateur_autre, '')) <= 500
    and length(coalesce(type_bruleage_autre, '')) <= 500
    and cardinality(observations_post_bruleage) between 1 and 13
    and length(coalesce(email_provider_id, '')) <= 200
    and length(coalesce(email_error, '')) <= 1000
  ) not valid;

alter table public.main_courantes
  add constraint main_courantes_input_bounds
  check (
    length(pdf_storage_path) <= 500
    and length(pdf_filename) <= 180
    and pdf_file_size between 1 and 5242880
    and length(email_formateur) <= 320
    and cardinality(meteo) <= 4
    and cardinality(chariot_foyer_demarrage) <= 2
    and cardinality(formateurs) <= 50
    and cardinality(formateur_roles) <= 50
    and length(array_to_string(coalesce(formateurs, '{}'), ' ')) <= 10000
    and length(array_to_string(coalesce(formateur_roles, '{}'), ' ')) <= 1000
    and length(coalesce(email_provider_id, '')) <= 200
    and length(coalesce(email_error, '')) <= 1000
  ) not valid;

alter table public.equipment_repair_requests
  add constraint equipment_repair_requests_input_bounds
  check (
    length(pdf_storage_path) <= 500
    and length(pdf_filename) <= 180
    and pdf_file_size between 1 and 5242880
    and length(email_demandeur) <= 320
    and length(coalesce(email_provider_id, '')) <= 200
    and length(coalesce(email_error, '')) <= 1000
  ) not valid;

alter table public.carpool_trips
  add constraint carpool_trips_text_limits
  check (
    length(departure_city) <= 120
    and length(departure_label) <= 500
    and length(arrival_label) <= 500
    and length(coalesce(price_note, '')) <= 500
    and length(coalesce(vehicle_note, '')) <= 1000
    and length(coalesce(luggage_note, '')) <= 1000
    and length(coalesce(notes, '')) <= 4000
  ) not valid;

alter table public.carpool_requests
  add constraint carpool_requests_message_limit
  check (length(coalesce(message, '')) <= 4000) not valid;
