import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PGLITE_MODULE;
if (!modulePath) throw new Error('Set PGLITE_MODULE to an installed PGlite module.');
const { PGlite } = await import(pathToFileURL(modulePath));
const migration = await readFile(
  new URL('../migrations/20260920064930_remove_default_trainer_qualification.sql', import.meta.url),
  'utf8',
);

test('new profiles remain unqualified until an administrator assigns trainer levels', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());

  await db.exec(`
    create table public.profiles (
      id uuid primary key,
      trainer_levels text[] not null default array['RSFR']::text[]
    );
    alter table public.profiles
      add constraint profiles_trainer_levels_check
      check (
        cardinality(trainer_levels) > 0
        and trainer_levels <@ array['RSFR', 'FOR INC', 'FOR BAT']::text[]
      );
    create table public.profile_directory (
      id uuid primary key,
      trainer_levels text[] not null default array['RSFR']::text[]
    );
  `);

  await db.exec(migration);
  await db.exec(migration);

  const defaults = await db.query(`
    select table_name, column_default
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'trainer_levels'
    order by table_name
  `);
  assert.deepEqual(
    defaults.rows.map((row) => row.column_default),
    ["'{}'::text[]", "'{}'::text[]"],
  );

  await db.query(
    `insert into public.profiles (id) values ('11111111-1111-4111-8111-111111111111')`,
  );
  const created = await db.query('select trainer_levels from public.profiles');
  assert.deepEqual(created.rows[0].trainer_levels, []);

  await assert.rejects(
    () => db.query(
      `insert into public.profiles (id, trainer_levels)
       values ('22222222-2222-4222-8222-222222222222', array['UNKNOWN']::text[])`,
    ),
    /profiles_trainer_levels_check/,
  );

  await db.query(
    `insert into public.profiles (id, trainer_levels)
     values ('33333333-3333-4333-8333-333333333333', array['FOR INC']::text[])`,
  );
});
