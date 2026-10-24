// Executes the active-session RLS migration against a synthetic PostgreSQL
// policy fixture. No remote project access.
// PGLITE_MODULE=/tmp/flashover-mfa-db-test/node_modules/@electric-sql/pglite/dist/index.js node --test supabase/tests/active-session-rls-check.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PGLITE_MODULE;
if (!modulePath) throw new Error('Set PGLITE_MODULE to an installed PGlite module.');
const { PGlite } = await import(pathToFileURL(modulePath));
const userId = '11111111-1111-4111-8111-111111111111';
const sessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const fixtureSql = `
  create role anon; create role authenticated;
  create schema auth; create schema private; create schema storage;
  grant usage on schema auth, private, storage to authenticated;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  create function auth.uid() returns uuid language sql stable as $$
    select (auth.jwt()->>'sub')::uuid
  $$;
  create table auth.sessions (id uuid primary key, user_id uuid not null);
  create function private.has_active_session() returns boolean
  language sql stable security definer set search_path = '' as $$
    select exists (
      select 1 from auth.sessions
      where id::text = auth.jwt()->>'session_id' and user_id = auth.uid()
    )
  $$;
  create function private.is_admin() returns boolean
  language sql stable security definer set search_path = '' as $$ select false $$;
  create function private.has_role(text) returns boolean
  language sql stable security definer set search_path = '' as $$ select false $$;
  create function private.document_storage_upload_allowed(text, text, jsonb)
  returns boolean language sql stable as $$ select true $$;
  create function private.pdf_storage_upload_allowed(text, text, jsonb)
  returns boolean language sql stable as $$ select true $$;
  create function storage.foldername(text) returns text[] language sql immutable as $$
    select string_to_array($1, '/')
  $$;
  create table public.profiles (id uuid primary key, role text);
  create table public.profile_directory (id uuid primary key);
  create table public.events (id uuid primary key, driver_id uuid);
  create table public.resources (id uuid primary key, bucket_id text, current_storage_path text);
  create table public.carpool_trips (id uuid primary key, driver_id uuid);
  create table public.carpool_requests (id uuid primary key, trip_id uuid, requester_id uuid);
  create table public.carpool_posts (id uuid primary key, author_id uuid);
  create table public.carpool_matches (id uuid primary key, initiator_id uuid, offer_post_id uuid, need_post_id uuid);
  create table public.training_registrations (id uuid primary key, user_id uuid);
  create table public.training_audit_log (id uuid primary key);
  create table public.resource_versions (id uuid primary key, bucket_id text, storage_path text);
  create table public.document_favorites (id uuid primary key, user_id uuid);
  create table public.document_offline_selections (id uuid primary key, user_id uuid);
  create table public.document_audit_log (id uuid primary key);
  create table public.email_destinations (form_key text primary key);
  create table public.medical_follow_ups (id uuid primary key, user_id uuid);
  create table public.main_courantes (id uuid primary key, user_id uuid, pdf_storage_path text);
  create table public.equipment_repair_requests (id uuid primary key, user_id uuid, pdf_storage_path text);
  create table storage.objects (bucket_id text, name text, owner_id text, metadata jsonb);
`;

const tableNames = [
  'profiles', 'profile_directory', 'events', 'resources', 'carpool_trips',
  'carpool_requests', 'carpool_posts', 'carpool_matches', 'training_registrations',
  'training_audit_log', 'resource_versions', 'document_favorites',
  'document_offline_selections', 'document_audit_log', 'email_destinations',
  'medical_follow_ups', 'main_courantes', 'equipment_repair_requests',
];

const policies = [
  ['profile_directory_select_authenticated', 'profile_directory', 'select'],
  ['profiles_select_self_or_admin', 'profiles', 'select'],
  ['events_select_authenticated', 'events', 'select'],
  ['events_insert_contributor', 'events', 'insert'],
  ['events_update_contributor', 'events', 'update'],
  ['events_delete_admin', 'events', 'delete'],
  ['resources_select_authenticated', 'resources', 'select'],
  ['carpool_trips_select_authenticated', 'carpool_trips', 'select'],
  ['carpool_trips_insert_driver', 'carpool_trips', 'insert'],
  ['carpool_trips_update_driver', 'carpool_trips', 'update'],
  ['carpool_requests_select_involved', 'carpool_requests', 'select'],
  ['carpool_posts_select_authenticated', 'carpool_posts', 'select'],
  ['carpool_matches_select_involved', 'carpool_matches', 'select'],
  ['training_registrations_select_own_or_admin', 'training_registrations', 'select'],
  ['training_audit_log_select_admin', 'training_audit_log', 'select'],
  ['resource_versions_select_authenticated', 'resource_versions', 'select'],
  ['document_favorites_select_own', 'document_favorites', 'select'],
  ['document_offline_selections_select_own', 'document_offline_selections', 'select'],
  ['document_audit_log_select_admin', 'document_audit_log', 'select'],
  ['email_destinations_select_authenticated', 'email_destinations', 'select'],
  ['medical_follow_ups_select_own', 'medical_follow_ups', 'select'],
  ['medical_follow_ups_insert_own', 'medical_follow_ups', 'insert'],
  ['medical_follow_ups_update_own', 'medical_follow_ups', 'update'],
  ['main_courantes_select_own', 'main_courantes', 'select'],
  ['main_courantes_insert_own', 'main_courantes', 'insert'],
  ['equipment_repair_requests_select_own', 'equipment_repair_requests', 'select'],
  ['equipment_repair_requests_insert_own', 'equipment_repair_requests', 'insert'],
  ['documents_select_authenticated', 'objects', 'select'],
  ['documents_insert_contributor', 'objects', 'insert'],
  ['documents_delete_unreferenced_owner', 'objects', 'delete'],
  ['main_courantes_storage_select_own', 'objects', 'select'],
  ['main_courantes_storage_insert_own', 'objects', 'insert'],
  ['main_courantes_storage_delete_unreferenced_own', 'objects', 'delete'],
  ['equipment_repair_requests_storage_select_own', 'objects', 'select'],
  ['equipment_repair_requests_storage_insert_own', 'objects', 'insert'],
  ['equipment_repair_requests_storage_delete_unreferenced_own', 'objects', 'delete'],
];

function policySql([name, table, command]) {
  const qualifiedTable = table === 'objects' ? 'storage.objects' : `public.${table}`;
  const clause = command === 'select' || command === 'delete'
    ? `using (true)`
    : command === 'insert'
      ? `with check (true)`
      : `using (true) with check (true)`;
  return `create policy "${name}" on ${qualifiedTable} for ${command} to authenticated ${clause};`;
}

test('revoked sessions no longer satisfy ordinary RLS policies', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());

  await db.exec(fixtureSql);
  await db.exec(tableNames.map((table) => `alter table public.${table} enable row level security;`).join('\n'));
  await db.exec('alter table storage.objects enable row level security;');
  await db.exec('grant select, insert, update, delete on all tables in schema public to authenticated; grant select, insert, update, delete on storage.objects to authenticated;');
  await db.exec(policies.map(policySql).join('\n'));
  await db.exec(await readFile(new URL('../migrations/20260919090000_active_session_rls.sql', import.meta.url), 'utf8'));

  // The current migration history deliberately removed the legacy news tables.
  // This assertion keeps the fixture representative and makes a future
  // reference to those obsolete relations fail during migration replay.
  assert.equal(
    (await db.query("select to_regclass('public.news') as relation")).rows[0].relation,
    null,
  );
  assert.equal(
    (await db.query("select to_regclass('public.news_reads') as relation")).rows[0].relation,
    null,
  );

  await db.exec(`
    insert into auth.sessions values ('${sessionId}', '${userId}');
    insert into public.events values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', null);
    select set_config('request.jwt.claims', '${JSON.stringify({ sub: userId, session_id: sessionId })}', false);
    set role authenticated;
  `);
  assert.equal((await db.query('select count(*)::int as count from public.events')).rows[0].count, 1);
  assert.equal(
    (await db.query("select has_function_privilege('authenticated', 'private.has_active_session()', 'execute') as allowed")).rows[0].allowed,
    true,
  );

  await db.exec(`reset role; delete from auth.sessions where id = '${sessionId}'; set role authenticated;`);
  assert.equal((await db.query('select count(*)::int as count from public.events')).rows[0].count, 0);
});
