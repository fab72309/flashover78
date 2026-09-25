// Executes security-critical excerpts of the real additive migration in isolated
// PostgreSQL fixtures. No remote project access.
// PGLITE_MODULE=/tmp/flashover-mfa-db-test/node_modules/@electric-sql/pglite/dist/index.js node --test supabase/tests/security-hardening-check.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PGLITE_MODULE;
if (!modulePath) throw new Error('Set PGLITE_MODULE to an installed PGlite module.');
const { PGlite } = await import(pathToFileURL(modulePath));
const migration = await readFile(
  new URL('../migrations/20260918015321_security_audit_hardening.sql', import.meta.url),
  'utf8',
);

function section(start, end) {
  const startIndex = migration.indexOf(start);
  const endIndex = migration.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing migration marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing migration marker: ${end}`);
  return migration.slice(startIndex, endIndex);
}

const contributor = '11111111-1111-4111-8111-111111111111';
const driver = '22222222-2222-4222-8222-222222222222';
const passengerOne = '33333333-3333-4333-8333-333333333333';
const passengerTwo = '44444444-4444-4444-8444-444444444444';
const outsider = '55555555-5555-4555-8555-555555555555';
const offer = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const needOne = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const needTwo = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

async function setUser(db, userId) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub: userId, session_id: userId }),
  ]);
  await db.exec('set role authenticated');
}

test('capacity is not directly insertable or updatable by contributors', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role authenticated;
    create table public.events (
      id uuid primary key default gen_random_uuid(), title text, description text,
      observations text, location text, formateurs text[], formateur_ids uuid[],
      formateur_levels text[], date timestamptz, registration_closes_at timestamptz,
      capacity integer not null default 12, created_at timestamptz default now()
    );
    grant select, insert, update, delete on public.events to authenticated;
  `);
  await db.exec(section('-- Contributors can update scheduling content', '-- Document objects are immutable'));

  const { rows: [privileges] } = await db.query(`
    select
      has_column_privilege('authenticated', 'public.events', 'title', 'INSERT') as title_insert,
      has_column_privilege('authenticated', 'public.events', 'capacity', 'INSERT') as capacity_insert,
      has_column_privilege('authenticated', 'public.events', 'title', 'UPDATE') as title_update,
      has_column_privilege('authenticated', 'public.events', 'capacity', 'UPDATE') as capacity_update
  `);
  assert.deepEqual(privileges, {
    title_insert: true,
    capacity_insert: false,
    title_update: true,
    capacity_update: false,
  });
  await assert.rejects(
    () => db.query(
      `insert into public.events(title, description, location)
       values ($1, 'description', 'location')`,
      ['x'.repeat(201)],
    ),
    /events_text_limits/,
  );
});

test('public profile sync never bootstraps or overwrites an administrator role', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema private;
    grant usage on schema auth, private to authenticated;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
    $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    create table auth.sessions (id uuid primary key, user_id uuid not null);
    create function private.has_active_session() returns boolean
    language sql stable security definer set search_path = '' as $$
      select exists (
        select 1 from auth.sessions
        where id::text = auth.jwt()->>'session_id'
          and user_id = auth.uid()
      )
    $$;
    create table auth.users (id uuid primary key, email text, created_at timestamptz default now());
    create table public.profiles (
      id uuid primary key, email text not null, display_name text not null,
      first_name text, last_name text, phone text, is_admin boolean not null default false,
      role text not null default 'member'
    );
    insert into auth.users(id, email) values
      ('${contributor}', 'first@example.invalid'),
      ('${driver}', 'admin@example.invalid');
    insert into auth.sessions values
      ('${contributor}', '${contributor}'), ('${driver}', '${driver}');
    insert into public.profiles values
      ('${driver}', 'admin@example.invalid', 'Admin', null, null, null, true, 'admin');
  `);
  await db.exec(section('-- Account creation may never bootstrap', '-- Contributors can update scheduling content'));

  await setUser(db, contributor);
  const { rows: [created] } = await db.query(
    "select role, is_admin from public.sync_my_profile('First', null, null, null)",
  );
  assert.deepEqual(created, { role: 'member', is_admin: false });
  await assert.rejects(
    () => db.query(
      "select role from public.sync_my_profile($1, null, null, null)",
      ['x'.repeat(201)],
    ),
    /profiles_text_limits/,
  );

  await setUser(db, driver);
  const { rows: [updated] } = await db.query(
    "select role, is_admin from public.sync_my_profile('Still Admin', null, null, null)",
  );
  assert.deepEqual(updated, { role: 'admin', is_admin: true });
});

test('carpool contacts never disclose unrelated or unaccepted passengers', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema private;
    grant usage on schema auth, private to authenticated;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
    $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    create table auth.sessions (id uuid primary key, user_id uuid not null);
    create function private.has_active_session() returns boolean
    language sql stable security definer set search_path = '' as $$
      select exists (
        select 1 from auth.sessions
        where id::text = auth.jwt()->>'session_id'
          and user_id = auth.uid()
      )
    $$;
    create table public.profiles (id uuid primary key, email text, phone text, role text);
    create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
      select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
    $$;
    create table public.carpool_trips (id uuid primary key, driver_id uuid);
    create table public.carpool_requests (id uuid primary key, trip_id uuid, requester_id uuid, status text);
    create table public.carpool_posts (id uuid primary key, author_id uuid, kind text);
    create table public.carpool_matches (
      id uuid primary key, offer_post_id uuid, need_post_id uuid, status text
    );
    insert into public.profiles values
      ('${driver}', 'driver@example.invalid', '0100000001', 'member'),
      ('${passengerOne}', 'p1@example.invalid', '0100000002', 'member'),
      ('${passengerTwo}', 'p2@example.invalid', '0100000003', 'member'),
      ('${outsider}', 'out@example.invalid', '0100000004', 'member');
    insert into auth.sessions(id, user_id) values
      ('${driver}', '${driver}'), ('${passengerOne}', '${passengerOne}'),
      ('${passengerTwo}', '${passengerTwo}'), ('${outsider}', '${outsider}');
    insert into public.carpool_posts values
      ('${offer}', '${driver}', 'offer'),
      ('${needOne}', '${passengerOne}', 'need'),
      ('${needTwo}', '${passengerTwo}', 'need');
    insert into public.carpool_matches values
      (gen_random_uuid(), '${offer}', '${needOne}', 'accepted'),
      (gen_random_uuid(), '${offer}', '${needTwo}', 'accepted');
    insert into public.carpool_trips values ('${offer}', '${driver}');
    insert into public.carpool_requests values
      (gen_random_uuid(), '${offer}', '${passengerOne}', 'accepted'),
      (gen_random_uuid(), '${offer}', '${passengerTwo}', 'pending');
  `);
  await db.exec(section('-- Legacy contacts:', '-- Append-only business audit'));

  await setUser(db, passengerOne);
  const passengerContacts = await db.query(
    'select user_id from public.get_carpool_post_contacts($1)', [offer],
  );
  assert.deepEqual(passengerContacts.rows.map((row) => row.user_id), [driver]);

  await setUser(db, driver);
  const driverContacts = await db.query(
    'select user_id from public.get_carpool_post_contacts($1) order by user_id', [offer],
  );
  assert.deepEqual(
    new Set(driverContacts.rows.map((row) => row.user_id)),
    new Set([driver, passengerOne, passengerTwo]),
  );
  const legacy = await db.query('select user_id from public.get_carpool_contacts($1)', [offer]);
  assert.deepEqual(new Set(legacy.rows.map((row) => row.user_id)), new Set([driver, passengerOne]));

  await setUser(db, outsider);
  await assert.rejects(
    () => db.query('select * from public.get_carpool_post_contacts($1)', [offer]),
    /Contacts disponibles/,
  );
});

test('document storage policy enforces owner, metadata and size bounds', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const owner = '66666666-6666-4666-8666-666666666666';
  const otherOwner = '77777777-7777-4777-8777-777777777777';
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema private; create schema storage;
    grant usage on schema auth, private, storage to authenticated;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
    $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    create table auth.sessions (id uuid primary key, user_id uuid not null);
    insert into auth.sessions values ('${owner}', '${owner}'), ('${otherOwner}', '${otherOwner}');
    create function private.has_active_session() returns boolean
    language sql stable security definer set search_path = '' as $$
      select exists (
        select 1 from auth.sessions
        where id::text = auth.jwt()->>'session_id'
          and user_id = auth.uid()
      )
    $$;
    create function storage.foldername(value text) returns text[] language sql immutable as $$
      select string_to_array(value, '/')
    $$;
    create table public.profiles (id uuid primary key, role text not null);
    insert into public.profiles values ('${owner}', 'contributor'), ('${otherOwner}', 'contributor');
    create function private.has_role(required_role text) returns boolean
    language sql stable security definer set search_path = '' as $$
      select exists (
        select 1 from public.profiles
        where id = auth.uid()
          and case required_role
            when 'member' then role in ('member', 'contributor', 'admin')
            when 'contributor' then role in ('contributor', 'admin')
            when 'admin' then role = 'admin'
            else false
          end
      )
    $$;
    create table storage.objects (
      bucket_id text not null,
      name text not null,
      owner_id text,
      metadata jsonb
    );
    alter table storage.objects enable row level security;
    grant insert on storage.objects to authenticated;
    create table public.resources (bucket_id text, current_storage_path text);
    create table public.resource_versions (bucket_id text, storage_path text);
    create table public.main_courantes (user_id uuid, pdf_storage_path text);
    create table public.equipment_repair_requests (user_id uuid, pdf_storage_path text);
  `);
  await db.exec(section('-- Document objects are immutable', '-- A submitted PDF'));
  await setUser(db, owner);

  await db.query(
    `insert into storage.objects(bucket_id, name, owner_id, metadata)
     values ('resources', $1, $2, $3::jsonb)`,
    [`${owner}/catalog/new/guide.pdf`, owner, JSON.stringify({ size: '100', mimetype: 'application/pdf' })],
  );

  await assert.rejects(
    () => db.query(
      `insert into storage.objects(bucket_id, name, owner_id, metadata)
       values ('resources', $1, $2, $3::jsonb)`,
      [`${otherOwner}/catalog/new/guide.pdf`, owner, JSON.stringify({ size: '100', mimetype: 'application/pdf' })],
    ),
    /violates row-level security policy/,
  );
  await assert.rejects(
    () => db.query(
      `insert into storage.objects(bucket_id, name, owner_id, metadata)
       values ('resources', $1, $2, $3::jsonb)`,
      [`${owner}/catalog/new/guide.pdf`, owner, JSON.stringify({ size: '22000000', mimetype: 'application/pdf' })],
    ),
    /violates row-level security policy/,
  );

  const pdfPath = `${owner}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/main-courante.pdf`;
  await db.query(
    `insert into storage.objects(bucket_id, name, owner_id, metadata)
     values ('main-courantes', $1, $2, $3::jsonb)`,
    [pdfPath, owner, JSON.stringify({ size: '1024', mimetype: 'application/pdf' })],
  );
  await assert.rejects(
    () => db.query(
      `insert into storage.objects(bucket_id, name, owner_id, metadata)
       values ('main-courantes', $1, $2, $3::jsonb)`,
      [`${owner}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/main-courante.pdf`, owner, JSON.stringify({ size: '1024', mimetype: 'text/plain' })],
    ),
    /violates row-level security policy/,
  );
  await assert.rejects(
    () => db.query(
      `insert into storage.objects(bucket_id, name, owner_id, metadata)
       values ('equipment-repair-requests', $1, $2, $3::jsonb)`,
      [`${owner}/cccccccc-cccc-4ccc-8ccc-cccccccccccc/request.pdf`, owner, JSON.stringify({ size: '5242881', mimetype: 'application/pdf' })],
    ),
    /violates row-level security policy/,
  );
});

test('email delivery claim is atomic, recoverable and capped', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const submissionId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema private;
    grant usage on schema auth, private to authenticated;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
    $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    create table auth.sessions (id uuid primary key, user_id uuid not null);
    insert into auth.sessions values ('${contributor}', '${contributor}');
    create function private.has_active_session() returns boolean
    language sql stable security definer set search_path = '' as $$
      select exists (
        select 1 from auth.sessions
        where id::text = auth.jwt()->>'session_id'
          and user_id = auth.uid()
      )
    $$;
    create table public.medical_follow_ups (
      id uuid primary key, user_id uuid, email_status text not null default 'pending'
        constraint medical_follow_ups_email_status_check check (email_status in ('pending','sent','failed')),
      email_sent_at timestamptz, email_error text, created_at timestamptz default now(), updated_at timestamptz default now()
    );
    create table public.main_courantes (
      id uuid primary key, user_id uuid, email_status text not null default 'pending'
        constraint main_courantes_email_status_check check (email_status in ('pending','sent','failed')),
      email_sent_at timestamptz, email_error text, created_at timestamptz default now(), updated_at timestamptz default now()
    );
    create table public.equipment_repair_requests (
      id uuid primary key, user_id uuid, email_status text not null default 'pending'
        constraint equipment_repair_requests_email_status_check check (email_status in ('pending','sent','failed')),
      email_sent_at timestamptz, email_error text, created_at timestamptz default now(), updated_at timestamptz default now()
    );
    create table public.email_destinations (recipients text[] not null);
    insert into public.medical_follow_ups(id, user_id) values ('${submissionId}', '${contributor}');
    insert into public.medical_follow_ups(id, user_id)
    select gen_random_uuid(), '${contributor}' from generate_series(1, 19);
  `);
  await db.exec(section('-- A user-wide window limits abuse', '-- Email delivery is claimed atomically'));
  await db.exec(section('-- Email delivery is claimed atomically', '-- Direct API calls receive'));
  await setUser(db, contributor);

  const claim = async () => (await db.query(
    "select public.claim_form_email_delivery('suivi_medical', $1, false) as claimed",
    [submissionId],
  )).rows[0].claimed;
  assert.equal(await claim(), true);
  assert.equal(await claim(), false);

  await db.exec(`reset role; update public.medical_follow_ups set email_status='failed', email_attempt_count=4; set role authenticated`);
  assert.equal(await claim(), true);
  await db.exec(`reset role; update public.medical_follow_ups set email_status='failed'; set role authenticated`);
  assert.equal(await claim(), false);

  await db.exec('reset role');
  const quotaIds = (await db.query(
    `select id from public.medical_follow_ups where id <> $1 order by id`,
    [submissionId],
  )).rows.map((row) => row.id);
  await db.exec('set role authenticated');
  for (const [index, id] of quotaIds.entries()) {
    const attempt = () => db.query(
      "select public.claim_form_email_delivery('suivi_medical', $1, false) as claimed",
      [id],
    );
    if (index < 18) {
      assert.equal((await attempt()).rows[0].claimed, true);
    } else {
      await assert.rejects(attempt, /Email delivery rate limit exceeded/);
    }
  }
});
