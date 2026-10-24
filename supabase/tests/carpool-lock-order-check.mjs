import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PGLITE_MODULE;
if (!modulePath) throw new Error('Set PGLITE_MODULE to an installed PGlite module.');
const { PGlite } = await import(pathToFileURL(modulePath));
const migration = await readFile(
  new URL('../migrations/20260919190100_carpool_lock_order_hardening.sql', import.meta.url),
  'utf8',
);

test('carpool post cancellation locks all related posts in UUID order and is replay-safe', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());

  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create schema private;
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create function private.has_active_session() returns boolean
      language sql stable security definer set search_path = '' as $$ select false $$;
    create function private.is_admin() returns boolean
      language sql stable security definer set search_path = '' as $$ select false $$;
    create table public.carpool_posts (
      id uuid primary key,
      author_id uuid not null,
      kind text not null,
      status text not null,
      updated_at timestamptz
    );
    create table public.carpool_matches (
      id uuid primary key,
      offer_post_id uuid not null,
      need_post_id uuid not null,
      initiator_id uuid not null,
      seats_requested integer not null,
      message text,
      status text not null,
      updated_at timestamptz
    );
    create function private.refresh_carpool_post_status(uuid)
      returns void language plpgsql security definer set search_path = '' as $$ begin return; end $$;
  `);

  await db.exec(migration);
  await db.exec(migration);

  const { rows: [row] } = await db.query(
    `select pg_get_functiondef('public.cancel_carpool_post(uuid)'::regprocedure) as definition`,
  );
  assert.match(row.definition, /current_user_id is null or not private\.has_active_session\(\)/);
  assert.match(row.definition, /order by post\.id\s+for update/i);
  assert.match(row.definition, /select \* into target_post[\s\S]*?for update/i);
  assert.ok(row.definition.indexOf('order by post.id') < row.definition.indexOf('select * into target_post', row.definition.indexOf('order by post.id')));
});
