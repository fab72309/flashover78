import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PGLITE_MODULE;
if (!modulePath) throw new Error('Set PGLITE_MODULE to an installed PGlite module.');
const { PGlite } = await import(pathToFileURL(modulePath));
const migration = await readFile(
  new URL('../migrations/20260919190000_query_response_bounds.sql', import.meta.url),
  'utf8',
);

test('query response migration parses and replaces the collection RPCs', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create schema auth; create schema private;
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create function private.has_active_session() returns boolean language sql stable as $$ select true $$;
    create function private.is_admin() returns boolean language sql stable as $$ select true $$;
    create table public.resources (
      id uuid, title text, category text, tags text[], version_label text,
      author_name text, effective_at date, expires_at date, original_filename text,
      mime_type text, file_size bigint, bucket_id text, current_storage_path text,
      updated_at timestamptz, search_vector tsvector
    );
    create table public.document_favorites (resource_id uuid, user_id uuid);
    create table public.document_offline_selections (resource_id uuid, user_id uuid);
    create table public.resource_versions (
      id uuid, resource_id uuid, version_label text, bucket_id text, storage_path text,
      original_filename text, mime_type text, file_size bigint, author_name text,
      effective_at date, expires_at date, created_at timestamptz
    );
    create table public.events (id uuid, capacity integer);
    create table public.training_registrations (
      id uuid, event_id uuid, user_id uuid, status text, attendance text, registered_at timestamptz
    );
    create table public.profiles (id uuid, display_name text, email text, phone text);
  `);

  await db.exec(migration);
  const { rows: [search] } = await db.query(
    `select pg_get_functiondef('public.search_documents(text,text,text,boolean,text,uuid)'::regprocedure) as definition`,
  );
  const { rows: [versions] } = await db.query(
    `select pg_get_functiondef('public.list_document_versions(uuid)'::regprocedure) as definition`,
  );
  assert.match(search.definition, /limit 200/i);
  assert.match(versions.definition, /limit 200/i);
});
