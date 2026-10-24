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
const globalMigration = await readFile(
  new URL('../migrations/20260919190200_global_form_email_rate_limit.sql', import.meta.url),
  'utf8',
);

function section(start, end) {
  const startIndex = migration.indexOf(start);
  const endIndex = migration.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing migration marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing migration marker: ${end}`);
  return migration.slice(startIndex, endIndex);
}

function userId(index) {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
}

function submissionId(index) {
  return `10000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
}

test('global form-email circuit breaker caps distributed claims and is replay-safe', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());

  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema private;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
    $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    create table auth.sessions (id uuid primary key, user_id uuid not null);
    create function private.has_active_session() returns boolean
      language sql stable security definer set search_path = '' as $$
        select exists (
          select 1 from auth.sessions
          where id::text = auth.jwt()->>'session_id' and user_id = auth.uid()
        )
      $$;
    create table public.medical_follow_ups (
      id uuid primary key, user_id uuid not null,
      email_status text not null default 'pending',
      email_sent_at timestamptz, email_error text,
      email_attempt_count integer not null default 0,
      email_last_attempt_at timestamptz,
      created_at timestamptz default now(), updated_at timestamptz default now()
    );
    create table public.main_courantes (
      id uuid primary key, user_id uuid not null,
      email_status text not null default 'pending',
      email_sent_at timestamptz, email_error text,
      email_attempt_count integer not null default 0,
      email_last_attempt_at timestamptz,
      created_at timestamptz default now(), updated_at timestamptz default now()
    );
    create table public.equipment_repair_requests (
      id uuid primary key, user_id uuid not null,
      email_status text not null default 'pending',
      email_sent_at timestamptz, email_error text,
      email_attempt_count integer not null default 0,
      email_last_attempt_at timestamptz,
      created_at timestamptz default now(), updated_at timestamptz default now()
    );
    create table public.email_destinations (recipients text[] not null);
    insert into auth.sessions
    select
      ('00000000-0000-4000-8000-' || lpad(to_hex(index), 12, '0'))::uuid,
      ('00000000-0000-4000-8000-' || lpad(to_hex(index), 12, '0'))::uuid
    from generate_series(1, 201) as values(index);
    insert into public.medical_follow_ups(id, user_id)
    select
      ('10000000-0000-4000-8000-' || lpad(to_hex(index), 12, '0'))::uuid,
      ('00000000-0000-4000-8000-' || lpad(to_hex(index), 12, '0'))::uuid
    from generate_series(1, 201) as values(index);
  `);

  await db.exec(section('-- A user-wide window limits abuse', '-- Email delivery is claimed atomically'));
  await db.exec(section('-- Email delivery is claimed atomically', '-- Direct API calls receive'));
  await db.exec(globalMigration);
  await db.exec(globalMigration);

  for (let index = 1; index <= 201; index += 1) {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claims', $1, false)", [
      JSON.stringify({ sub: userId(index), session_id: userId(index) }),
    ]);
    await db.exec('set role authenticated');

    const attempt = () => db.query(
      "select public.claim_form_email_delivery('suivi_medical', $1, false) as claimed",
      [submissionId(index)],
    );
    if (index <= 200) {
      assert.equal((await attempt()).rows[0].claimed, true);
    } else {
      await assert.rejects(attempt, /Global email delivery rate limit exceeded/);
    }
  }

  await db.exec('reset role');
  const { rows: [lastSubmission] } = await db.query(
    'select email_status, email_attempt_count from public.medical_follow_ups where id = $1',
    [submissionId(201)],
  );
  assert.deepEqual(lastSubmission, { email_status: 'pending', email_attempt_count: 0 });
});
