import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PGLITE_MODULE;
if (!modulePath) throw new Error('Set PGLITE_MODULE to an installed PGlite module.');
const { PGlite } = await import(pathToFileURL(modulePath));
const migration = await readFile(
  new URL('../migrations/20260919180000_document_server_finalization.sql', import.meta.url),
  'utf8',
);
const legacyMigration = await readFile(
  new URL('../migrations/20260919180022_block_legacy_office_uploads.sql', import.meta.url),
  'utf8',
);
const userId = '11111111-1111-4111-8111-111111111111';
const sessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

test('catalogue Storage requires server finalization and consumes one-time approval', async (t) => {
  assert.match(migration, /drop policy if exists "documents_insert_contributor"/i);
  assert.match(migration, /for update/i);
  assert.match(migration, /get diagnostics affected/i);
  assert.match(migration, /existing_objects\s*>=\s*200/i);
  assert.match(legacyMigration, /reject_legacy_office/i);
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private; create schema storage;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
    $$;
    create function auth.uid() returns uuid language sql stable as $$
      select (auth.jwt()->>'sub')::uuid
    $$;
    create function auth.role() returns text language sql stable as $$
      select auth.jwt()->>'role'
    $$;
    create table auth.sessions (id uuid primary key, user_id uuid not null);
    insert into auth.sessions values ('${sessionId}', '${userId}');
    create function private.has_active_session() returns boolean
      language sql stable security definer set search_path = '' as $$
      select exists (
        select 1 from auth.sessions
        where id::text = auth.jwt()->>'session_id' and user_id = auth.uid()
      )
    $$;
    create function private.has_role(required_role text) returns boolean
      language sql stable security definer set search_path = '' as $$
      select required_role = coalesce(auth.jwt()->>'app_role', '')
    $$;
    create function storage.foldername(value text) returns text[] language sql immutable as $$
      select case
        when strpos(value, '/') = 0 then '{}'::text[]
        else string_to_array(regexp_replace(value, '/[^/]*$', ''), '/')
      end
    $$;
    create function storage.filename(value text) returns text language sql immutable as $$
      select regexp_replace(value, '^.*/', '')
    $$;
    create table storage.objects (
      bucket_id text not null, name text not null, owner_id text, metadata jsonb
    );
    alter table storage.objects enable row level security;
    create policy documents_insert_contributor on storage.objects
      for insert to authenticated with check (true);
    create table public.resources (
      id uuid primary key, bucket_id text, current_storage_path text
    );
    create table public.resource_versions (
      id uuid primary key,
      bucket_id text,
      storage_path text,
      uploaded_by uuid,
      file_size bigint,
      mime_type text
    );
    grant usage on schema storage to authenticated;
    grant insert on storage.objects to authenticated;
    grant insert on public.resource_versions to authenticated;
  `);
  await db.exec(migration);
  await db.exec(legacyMigration);
  await db.exec(migration);
  await db.exec(legacyMigration);
  await db.exec(`
    create trigger resource_versions_validate_storage
    before insert on public.resource_versions
    for each row execute function private.enforce_resource_version_storage();
  `);

  const path = `${userId}/catalog/new/document.pdf`;
  await db.query(
    `insert into storage.objects values ('resources', $1, null, $2::jsonb)`,
    [path, JSON.stringify({ size: '2048', mimetype: 'application/pdf' })],
  );
  await db.query(
    "select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ role: 'service_role' })],
  );
  const { rows: [approval] } = await db.query(
    `select public.register_document_upload_approval('resources', $1, $2, 2048, 'application/pdf') as approved`,
    [path, userId],
  );
  assert.equal(approval.approved, true);

  await db.query(
    "select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ role: 'authenticated', sub: userId, session_id: sessionId, app_role: 'contributor' })],
  );
  await db.query(
    `insert into public.resource_versions values ($1, 'resources', $2, $3, 2048, 'application/pdf')`,
    ['22222222-2222-4222-8222-222222222222', path, userId],
  );
  const { rows: [consumed] } = await db.query(
    `select count(*)::int as count from private.document_upload_approvals where storage_path = $1 and consumed_at is null`,
    [path],
  );
  assert.equal(consumed.count, 0);

  const { rows: [policies] } = await db.query(
    `select count(*)::int as count from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'documents_insert_contributor'`,
  );
  assert.equal(policies.count, 0);
  await db.exec('set role authenticated');
  await assert.rejects(
    () => db.query(`insert into storage.objects values ('resources', $1, $2, $3::jsonb)`, [
      `${userId}/catalog/new/direct.pdf`, userId, JSON.stringify({ size: '4', mimetype: 'application/pdf' }),
    ]),
    /row-level security|policy/,
  );
  await db.exec('reset role');

  const secondPath = `${userId}/catalog/new/second.pdf`;
  await db.query(
    `insert into storage.objects values ('resources', $1, null, $2::jsonb)`,
    [secondPath, JSON.stringify({ size: '2048', mimetype: 'application/pdf' })],
  );
  await assert.rejects(
    () => db.query(
      `insert into public.resource_versions values ($1, 'resources', $2, $3, 2048, 'application/pdf')`,
      ['33333333-3333-4333-8333-333333333333', secondPath, userId],
    ),
    /finalisé par le serveur/,
  );

  const legacyPath = `${userId}/catalog/new/legacy.doc`;
  await db.query(
    `insert into storage.objects values ('resources', $1, null, $2::jsonb)`,
    [legacyPath, JSON.stringify({ size: '2048', mimetype: 'application/msword' })],
  );
  await db.query(
    "select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ role: 'service_role' })],
  );
  await assert.rejects(
    () => db.query(
      `select public.register_document_upload_approval('resources', $1, $2, 2048, 'application/msword')`,
      [legacyPath, userId],
    ),
    /Office legacy/,
  );

  await assert.rejects(
    () => db.query(
      `insert into public.resources (id, bucket_id, current_storage_path) values ($1, 'resources', $2)`,
      ['44444444-4444-4444-8444-444444444444', legacyPath],
    ),
    /Office legacy/,
  );

  const quotaObjects = Array.from({ length: 197 }, (_, index) => {
    const suffix = String(index).padStart(3, '0');
    return `insert into storage.objects values ('resources', '${userId}/quota/${suffix}.pdf', null, '{"size":"1","mimetype":"application/pdf"}'::jsonb);`;
  }).join('\n');
  await db.exec(quotaObjects);
  const boundaryPath = `${userId}/quota/boundary.pdf`;
  await db.query(
    `insert into storage.objects values ('resources', $1, null, $2::jsonb)`,
    [boundaryPath, JSON.stringify({ size: '1', mimetype: 'application/pdf' })],
  );
  await db.query(
    "select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ role: 'service_role' })],
  );
  await assert.rejects(
    () => db.query(
      `select public.register_document_upload_approval('resources', $1, $2, 1, 'application/pdf')`,
      [boundaryPath, userId],
    ),
    /Quota documentaire atteint/,
  );
});
