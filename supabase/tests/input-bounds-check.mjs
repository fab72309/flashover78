import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PGLITE_MODULE;
if (!modulePath) throw new Error('Set PGLITE_MODULE to an installed PGlite module.');
const { PGlite } = await import(pathToFileURL(modulePath));
const migration = await readFile(
  new URL('../migrations/20260919150000_input_bounds_hardening.sql', import.meta.url),
  'utf8',
);

test('remaining direct API text, array and PDF fields are bounded', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create table public.medical_follow_ups (
      id uuid primary key, temperature text, lieu_formation_autre text,
      formation_autre text, role_formateur_autre text, type_bruleage_autre text,
      observations_post_bruleage text[] not null, email_provider_id text, email_error text,
      nom_formateur text not null, prenom_formateur text not null, observations text
    );
    create table public.main_courantes (
      id uuid primary key, pdf_storage_path text not null, pdf_filename text not null,
      pdf_file_size bigint not null, email_formateur text not null, meteo text[] not null,
      chariot_foyer_demarrage text[] not null, formateurs text[] not null,
      formateur_roles text[] not null, email_provider_id text, email_error text
    );
    create table public.equipment_repair_requests (
      id uuid primary key, pdf_storage_path text not null, pdf_filename text not null,
      pdf_file_size bigint not null, email_demandeur text not null,
      email_provider_id text, email_error text
    );
    create table public.carpool_trips (
      id uuid primary key, departure_city text not null, departure_label text not null,
      arrival_label text not null, price_note text, vehicle_note text,
      luggage_note text, notes text
    );
    create table public.carpool_requests (
      id uuid primary key, message text
    );
  `);
  await db.exec(migration);

  await assert.rejects(
    () => db.query(
      `insert into public.medical_follow_ups
       values ('11111111-1111-4111-8111-111111111111', $1, null, null, null, null, array['Rien à signaler'], null, null, 'Nom', 'Prénom', null)`,
      ['1'.repeat(33)],
    ),
    /medical_follow_ups_input_bounds/,
  );
  await assert.rejects(
    () => db.query(
      `insert into public.main_courantes
       values ('22222222-2222-4222-8222-222222222222', $1, 'form.pdf', 1024, 'a@example.invalid', array['Pluie'], array['Vide'], array[]::text[], array[]::text[], null, null)`,
      ['a'.repeat(501)],
    ),
    /main_courantes_input_bounds/,
  );
  await assert.rejects(
    () => db.query(
      `insert into public.equipment_repair_requests
       values ('33333333-3333-4333-8333-333333333333', 'user/request.pdf', 'form.pdf', 5242881, 'a@example.invalid', null, null)`,
    ),
    /equipment_repair_requests_input_bounds/,
  );
  await assert.rejects(
    () => db.query(
      `insert into public.carpool_trips
       values ('44444444-4444-4444-8444-444444444444', 'Paris', 'Départ', 'Arrivée', null, null, null, $1)`,
      ['x'.repeat(4001)],
    ),
    /carpool_trips_text_limits/,
  );
  await assert.rejects(
    () => db.query(
      `insert into public.carpool_requests values ('55555555-5555-4555-8555-555555555555', $1)`,
      ['x'.repeat(4001)],
    ),
    /carpool_requests_message_limit/,
  );
});
