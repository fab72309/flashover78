import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PGLITE_MODULE;
if (!modulePath) throw new Error('Set PGLITE_MODULE to an installed PGlite module.');
const { PGlite } = await import(pathToFileURL(modulePath));
const migration = await readFile(
  new URL('../migrations/20260920064931_restrict_email_destinations.sql', import.meta.url),
  'utf8',
);

test('members cannot enumerate operational email destinations', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());

  await db.exec(`
    create role authenticated;
    create schema private;
    create function private.has_role(required_role text)
    returns boolean language sql stable as $$
      select (current_setting('request.jwt.claims', true)::jsonb ->> 'app_role') = required_role
    $$;
    create table public.email_destinations (
      form_key text primary key,
      recipients text[] not null
    );
    alter table public.email_destinations enable row level security;
    create policy email_destinations_select_authenticated
      on public.email_destinations for select to authenticated using (true);
    grant select on public.email_destinations to authenticated;
    insert into public.email_destinations values
      ('main_courante', array['security@example.test']);
  `);

  await db.exec(migration);
  await db.exec(migration);
  await db.query('grant usage on schema public to authenticated');
  await db.query('grant usage on schema private to authenticated');
  await db.query('grant execute on function private.has_role(text) to authenticated');

  await db.query('set role authenticated');
  await db.query(
    "select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ app_role: 'member' })],
  );
  const memberRows = await db.query('select * from public.email_destinations');
  assert.equal(memberRows.rows.length, 0);

  await db.query(
    "select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ app_role: 'admin' })],
  );
  const adminRows = await db.query('select * from public.email_destinations');
  assert.equal(adminRows.rows.length, 1);
  assert.equal(adminRows.rows[0].recipients[0], 'security@example.test');

  const policy = await db.query(`
    select policyname, qual
    from pg_policies
    where schemaname = 'public' and tablename = 'email_destinations'
  `);
  assert.deepEqual(policy.rows.map((row) => row.policyname), ['email_destinations_select_admin']);
  assert.match(policy.rows[0].qual, /has_role/);
});
