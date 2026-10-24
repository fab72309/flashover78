import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PGLITE_MODULE;
if (!modulePath) throw new Error('Set PGLITE_MODULE to an installed PGlite module.');
const { PGlite } = await import(pathToFileURL(modulePath));
const migration = await readFile(
  new URL('../migrations/20260919200000_document_contributor_publish.sql', import.meta.url),
  'utf8',
);

const userId = '11111111-1111-4111-8111-111111111111';

test('contributors can publish catalogue versions without gaining metadata administration', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());

  await db.exec(`
    create schema auth;
    create schema private;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
    $$;
    create function auth.uid() returns uuid language sql stable as $$
      select (auth.jwt()->>'sub')::uuid
    $$;
    create function private.is_admin() returns boolean language sql stable as $$
      select (auth.jwt()->>'app_role') = 'admin'
    $$;
    create function private.has_role(required_role text) returns boolean language sql stable as $$
      select case auth.jwt()->>'app_role'
        when 'admin' then true
        when 'contributor' then required_role in ('member', 'contributor')
        else required_role = 'member'
      end
    $$;
    create function public.create_document(
      text, text, text[], text, text, date, date, text, text, text, text, bigint
    ) returns uuid language plpgsql security definer set search_path = '' as $$
    declare current_user_id uuid := (select auth.uid());
    begin
      if current_user_id is null then
        raise exception 'Authentification requise';
      end if;
      if not (select private.is_admin()) then
        raise exception 'Action réservée aux responsables';
      end if;
      return current_user_id;
    end;
    $$;
    create function public.register_document_version(
      uuid, text, text, date, date, text, text, text, text, bigint
    ) returns uuid language plpgsql security definer set search_path = '' as $$
    declare current_user_id uuid := (select auth.uid());
    begin
      if current_user_id is null then
        raise exception 'Authentification requise';
      end if;
      if not (select private.is_admin()) then
        raise exception 'Action réservée aux responsables';
      end if;
      return current_user_id;
    end;
    $$;
  `);

  await db.exec(migration);
  await db.exec(migration);

  assert.match(migration, /create_document\(text,text,text\[\],text,text,date,date,text,text,text,text,bigint\)/);
  assert.match(migration, /register_document_version\(uuid,text,text,date,date,text,text,text,text,bigint\)/);
  assert.match(migration, /private\.has_role\(''contributor''\)/);

  await db.query(
    "select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ sub: userId, app_role: 'contributor' })],
  );
  const contributorCreate = await db.query(
    `select public.create_document('title', 'SDIS78', '{}', '1.0', 'author', null, null, 'resources', $1, 'file.pdf', 'application/pdf', 1) as actor`,
    [`${userId}/catalog/new/file.pdf`],
  );
  assert.equal(contributorCreate.rows[0].actor, userId);
  const contributorVersion = await db.query(
    `select public.register_document_version($1, '2.0', 'author', null, null, 'resources', $2, 'file.pdf', 'application/pdf', 1) as actor`,
    ['22222222-2222-4222-8222-222222222222', `${userId}/catalog/resource/file.pdf`],
  );
  assert.equal(contributorVersion.rows[0].actor, userId);

  await db.query(
    "select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ sub: userId, app_role: 'member' })],
  );
  await assert.rejects(
    () => db.query(
      `select public.create_document('title', 'SDIS78', '{}', '1.0', 'author', null, null, 'resources', $1, 'file.pdf', 'application/pdf', 1)`,
      [`${userId}/catalog/new/member.pdf`],
    ),
    /responsables/,
  );
});
