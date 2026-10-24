import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PGLITE_MODULE;
if (!modulePath) throw new Error('Set PGLITE_MODULE to an installed PGlite module.');
const { PGlite } = await import(pathToFileURL(modulePath));
const migration = await readFile(
  new URL('../migrations/20260919130000_rpc_active_session_hardening.sql', import.meta.url),
  'utf8',
);

const targets = [
  ['create_carpool_request', 'uuid, integer, text'],
  ['respond_to_carpool_request', 'uuid, text'],
  ['cancel_carpool_request', 'uuid'],
  ['cancel_carpool_trip', 'uuid'],
  ['create_carpool_post', 'uuid, text, text, text, timestamptz, text, integer, text, text, text, text'],
  ['request_carpool_ride', 'uuid, integer, text'],
  ['create_carpool_match', 'uuid, uuid, integer, text'],
  ['respond_to_carpool_match', 'uuid, text'],
  ['cancel_carpool_match', 'uuid'],
  ['cancel_carpool_post', 'uuid'],
  ['complete_carpool_post', 'uuid'],
  ['register_for_training', 'uuid'],
  ['cancel_training_registration', 'uuid'],
  ['get_training_session_summaries', 'uuid'],
  ['search_documents', 'text, text, text, boolean, text, uuid'],
  ['list_document_versions', 'uuid'],
  ['toggle_document_favorite', 'uuid'],
  ['set_document_offline_selected', 'uuid, boolean'],
];

function stubFunction(name, args) {
  const guard = name === 'list_document_versions'
    ? 'if (select auth.uid()) is null then'
    : 'if current_user_id is null then';
  const declaration = name === 'list_document_versions'
    ? ''
    : 'declare current_user_id uuid := (select auth.uid());';
  return `
    create function public.${name}(${args}) returns void
    language plpgsql security definer set search_path = '' as $$
    ${declaration}
    begin
      ${guard}
        raise exception 'Authentification requise';
      end if;
    end;
    $$;
  `;
}

test('RPC session hardening adds a live-session guard and is replay-safe', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());

  await db.exec(`
    create schema auth;
    create schema private;
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create function private.has_active_session() returns boolean
      language sql stable security definer set search_path = '' as $$ select false $$;
    ${targets.map(([name, args]) => stubFunction(name, args)).join('\n')}
  `);
  await db.exec(migration);
  await db.exec(migration);

  for (const [name, args] of targets) {
    const signature = `public.${name}(${args.replaceAll(' ', '')})`;
    const { rows: [row] } = await db.query(
      `select pg_get_functiondef($1::regprocedure) as definition`,
      [signature],
    );
    assert.match(row.definition, /not private\.has_active_session\(\)/, signature);
  }
});
