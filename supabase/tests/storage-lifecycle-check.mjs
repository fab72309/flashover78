import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PGLITE_MODULE;
if (!modulePath) throw new Error('Set PGLITE_MODULE to an installed PGlite module.');
const { PGlite } = await import(pathToFileURL(modulePath));
const migration = await readFile(
  new URL('../migrations/20260919140000_storage_lifecycle_hardening.sql', import.meta.url),
  'utf8',
);
const workerMigration = await readFile(
  new URL('../migrations/20260919160000_storage_cleanup_worker.sql', import.meta.url),
  'utf8',
);
const finalizerMigration = await readFile(
  new URL('../migrations/20260919170000_form_pdf_server_finalization.sql', import.meta.url),
  'utf8',
);
const userId = '11111111-1111-4111-8111-111111111111';
const sessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

test('form PDF quota, object binding and cleanup queue fail closed', async (t) => {
  assert.match(finalizerMigration, /drop policy if exists "main_courantes_storage_insert_own"/i);
  assert.match(finalizerMigration, /drop policy if exists "equipment_repair_requests_storage_insert_own"/i);
  assert.match(finalizerMigration, /for update/i);
  assert.match(finalizerMigration, /get diagnostics affected/i);
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
    create function private.is_admin() returns boolean
      language sql stable security definer set search_path = '' as $$ select false $$;
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
    create table public.resources (
      id uuid primary key, bucket_id text, current_storage_path text
    );
    create table public.resource_versions (
      id uuid primary key, bucket_id text, storage_path text
    );
    create table public.main_courantes (
      id uuid primary key, user_id uuid, pdf_storage_path text, pdf_file_size bigint
    );
    create table public.equipment_repair_requests (
      id uuid primary key, user_id uuid, pdf_storage_path text, pdf_file_size bigint
    );
  `);
  await db.exec(migration);
  await db.exec(finalizerMigration);
  await db.exec(finalizerMigration);
  await db.exec(workerMigration);
  await db.exec(`
    select set_config('request.jwt.claims', '${JSON.stringify({ sub: userId, session_id: sessionId })}', false);
  `);

  const firstPath = `${userId}/11111111-1111-4111-8111-111111111111/first.pdf`;
  await db.query(
    `insert into storage.objects values ('main-courantes', $1, $2, $3::jsonb)`,
    [firstPath, userId, JSON.stringify({ size: '1024', mimetype: 'application/pdf' })],
  );
  await db.query(
    `insert into public.main_courantes values ($1, $2, $3, 1024)`,
    ['11111111-1111-4111-8111-111111111111', userId, firstPath],
  );
  await assert.rejects(
    () => db.query(
      `insert into public.main_courantes values ($1, $2, $3, 2048)`,
      ['22222222-2222-4222-8222-222222222222', userId, firstPath],
    ),
    /correspondre à sa taille déclarée/,
  );

  const serverFinalizedPath = `${userId}/33333333-3333-4333-8333-333333333333/server.pdf`;
  await db.query(
    `insert into storage.objects values ('main-courantes', $1, null, $2::jsonb)`,
    [serverFinalizedPath, JSON.stringify({ size: '1024', mimetype: 'application/pdf' })],
  );
  await db.query(
    "select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ role: 'service_role' })],
  );
  const { rows: [approval] } = await db.query(
    `select public.register_form_pdf_approval('main-courantes', $1, $2, 1024) as approved`,
    [serverFinalizedPath, userId],
  );
  assert.equal(approval.approved, true);
  await db.query(
    "select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ role: 'authenticated', sub: userId, session_id: sessionId })],
  );
  await db.query(
    `insert into public.main_courantes values ($1, $2, $3, 1024)`,
    ['33333333-3333-4333-8333-333333333333', userId, serverFinalizedPath],
  );
  const { rows: [consumed] } = await db.query(
    `select count(*)::int as count from private.form_pdf_upload_approvals where storage_path = $1 and consumed_at is null`,
    [serverFinalizedPath],
  );
  assert.equal(consumed.count, 0);

  for (let index = 1; index < 48; index += 1) {
    const path = `${userId}/${String(index).padStart(8, '0')}-1111-4111-8111-111111111111/${index}.pdf`;
    await db.query(
      `insert into storage.objects values ('main-courantes', $1, $2, $3::jsonb)`,
      [path, userId, JSON.stringify({ size: '1024', mimetype: 'application/pdf' })],
    );
  }
  const boundaryServerPath = `${userId}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/boundary.pdf`;
  await db.query(
    `insert into storage.objects values ('main-courantes', $1, null, $2::jsonb)`,
    [boundaryServerPath, JSON.stringify({ size: '1024', mimetype: 'application/pdf' })],
  );
  await db.query(
    "select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ role: 'service_role' })],
  );
  await assert.rejects(
    () => db.query(
      `select public.register_form_pdf_approval('main-courantes', $1, $2, 1024)`,
      [boundaryServerPath, userId],
    ),
    /Quota PDF atteint/,
  );
  await db.query(
    "select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ role: 'authenticated', sub: userId, session_id: sessionId })],
  );
  const { rows: [quota] } = await db.query(
    `select private.pdf_storage_upload_allowed('main-courantes', $1, $2::jsonb) as allowed`,
    [`${userId}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/next.pdf`, JSON.stringify({ size: '1024', mimetype: 'application/pdf' })],
  );
  assert.equal(quota.allowed, false);

  const overQuotaServerPath = `${userId}/44444444-4444-4444-8444-444444444444/over-quota.pdf`;
  await db.query(
    `insert into storage.objects values ('main-courantes', $1, null, $2::jsonb)`,
    [overQuotaServerPath, JSON.stringify({ size: '1024', mimetype: 'application/pdf' })],
  );
  await db.query(
    "select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ role: 'service_role' })],
  );
  await assert.rejects(
    () => db.query(
      `select public.register_form_pdf_approval('main-courantes', $1, $2, 1024)`,
      [overQuotaServerPath, userId],
    ),
    /Quota PDF atteint/,
  );
  await db.query(
    "select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ role: 'authenticated', sub: userId, session_id: sessionId })],
  );
  await assert.rejects(
    () => db.query(
      `select public.enqueue_storage_cleanup_service_role('main-courantes', $1, $2)`,
      [overQuotaServerPath, userId],
    ),
    /worker de nettoyage/,
  );

  const { rows: [oversizedCast] } = await db.query(
    `select private.pdf_storage_upload_allowed('main-courantes', $1, $2::jsonb) as allowed`,
    [
      `${userId}/cccccccc-cccc-4ccc-8ccc-cccccccccccc/huge.pdf`,
      JSON.stringify({ size: '9999999999999999999', mimetype: 'application/pdf' }),
    ],
  );
  assert.equal(oversizedCast.allowed, false);

  await db.exec(`delete from public.main_courantes where id = '11111111-1111-4111-8111-111111111111';`);
  const { rows: [queued] } = await db.query(
    `select bucket_id, storage_path from private.storage_cleanup_queue where storage_path = $1`,
    [firstPath],
  );
  assert.deepEqual(queued, { bucket_id: 'main-courantes', storage_path: firstPath });

  await db.query(
    `select public.enqueue_storage_cleanup('main-courantes', $1)`,
    [firstPath],
  );
  await db.exec(`delete from auth.sessions where id = '${sessionId}';`);
  await assert.rejects(
    () => db.query(`select public.enqueue_storage_cleanup('main-courantes', $1)`, [firstPath]),
    /Authentification requise/,
  );

  await db.query(
    "select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ role: 'service_role' })],
  );
  await db.query(
    `select public.enqueue_storage_cleanup_service_role('main-courantes', $1, $2)`,
    [overQuotaServerPath, userId],
  );
  const { rows: [claimed] } = await db.query(
    `select count(*)::int as count from public.claim_storage_cleanup_batch(10)`,
  );
  assert.equal(claimed.count, 2);
});
