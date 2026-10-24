import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PGLITE_MODULE;
if (!modulePath) throw new Error('Set PGLITE_MODULE to an installed PGlite module.');
const { PGlite } = await import(pathToFileURL(modulePath));
const migration = await readFile(
  new URL('../migrations/20260919160000_storage_cleanup_worker.sql', import.meta.url),
  'utf8',
);

const firstId = '11111111-1111-4111-8111-111111111111';
const secondId = '22222222-2222-4222-8222-222222222222';

test('cleanup worker RPCs claim, recheck references and back off failures', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
    $$;
    create function auth.role() returns text language sql stable as $$
      select auth.jwt()->>'role'
    $$;
    create table private.storage_cleanup_queue (
      id uuid primary key,
      bucket_id text not null,
      storage_path text not null,
      attempt_count integer not null default 0,
      next_attempt_at timestamptz not null default timezone('utc', now()),
      last_error text,
      completed_at timestamptz,
      created_at timestamptz not null default timezone('utc', now())
    );
    create table public.resources (bucket_id text, current_storage_path text);
    create table public.resource_versions (bucket_id text, storage_path text);
    create table public.main_courantes (pdf_storage_path text);
    create table public.equipment_repair_requests (pdf_storage_path text);
    insert into private.storage_cleanup_queue (id, bucket_id, storage_path)
    values
      ('${firstId}', 'resources', '11111111-1111-4111-8111-111111111111/file.pdf'),
      ('${secondId}', 'resources', '22222222-2222-4222-8222-222222222222/file.pdf');
    select set_config('request.jwt.claims', '{"role":"service_role"}', false);
  `);
  await db.exec(migration);

  const { rows } = await db.query(
    `select id, should_delete from public.claim_storage_cleanup_batch(10) order by id`,
  );
  assert.deepEqual(rows, [
    { id: firstId, should_delete: true },
    { id: secondId, should_delete: true },
  ]);

  await db.query(
    `insert into public.resources (bucket_id, current_storage_path) values ('resources', $1)`,
    ['11111111-1111-4111-8111-111111111111/file.pdf'],
  );
  const { rows: [referenced] } = await db.query(
    `select public.storage_cleanup_is_referenced('resources', $1) as referenced`,
    ['11111111-1111-4111-8111-111111111111/file.pdf'],
  );
  assert.equal(referenced.referenced, true);

  const { rows: [completed] } = await db.query(
    `select public.complete_storage_cleanup($1, true, null) as completed`,
    [firstId],
  );
  assert.equal(completed.completed, true);

  const { rows: [failed] } = await db.query(
    `select public.complete_storage_cleanup($1, false, $2) as completed`,
    [secondId, 'x'.repeat(1200)],
  );
  assert.equal(failed.completed, true);
  const { rows: [state] } = await db.query(
    `select completed_at, length(last_error)::int as error_length, attempt_count, next_attempt_at > timezone('utc', now()) as delayed
     from private.storage_cleanup_queue where id = $1`,
    [secondId],
  );
  assert.equal(state.completed_at, null);
  assert.equal(state.error_length, 1000);
  assert.equal(state.attempt_count, 1);
  assert.equal(state.delayed, true);

  await db.query("select set_config('request.jwt.claims', '{\"role\":\"authenticated\"}', false)");
  await assert.rejects(
    () => db.query(`select public.claim_storage_cleanup_batch(1)`),
    /worker de nettoyage/,
  );
});
