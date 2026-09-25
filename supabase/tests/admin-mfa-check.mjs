// Isolated PostgreSQL execution with minimal Auth fixtures. No remote project access.
// npm install --prefix /tmp/flashover-mfa-db-test @electric-sql/pglite@0.5.8
// PGLITE_MODULE=/tmp/flashover-mfa-db-test/node_modules/@electric-sql/pglite/dist/index.js node --test supabase/tests/admin-mfa-check.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const modulePath = process.env.PGLITE_MODULE;
if (!modulePath) throw new Error('Set PGLITE_MODULE to an installed PGlite module (see instructions above).');
const { PGlite } = await import(pathToFileURL(modulePath));
const admin = '11111111-1111-4111-8111-111111111111';
const member = '22222222-2222-4222-8222-222222222222';
const contributor = '33333333-3333-4333-8333-333333333333';
const adminSession = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const memberSession = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const contributorSession = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

test('admin TOTP authorization and Auth audit isolation execute in PostgreSQL', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema private;
    grant usage on schema auth, private to authenticated;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    create table public.profiles (id uuid primary key, role text, display_name text);
    create table auth.mfa_factors (user_id uuid, factor_type text, status text);
    create table auth.sessions (id uuid primary key, user_id uuid not null);
    create table auth.audit_log_entries (id uuid primary key, created_at timestamptz, payload json, ip_address varchar(64));
    create function private.current_role() returns text language sql stable security definer set search_path='' as $$ select coalesce((select role from public.profiles where id=auth.uid()), 'member') $$;
    create function private.role_rank(text) returns int language sql immutable as $$ select case $1 when 'admin' then 30 when 'contributor' then 20 when 'member' then 10 else 0 end $$;
    create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select coalesce((select role = 'admin' from public.profiles where id=auth.uid()), false) $$;
    insert into public.profiles values ('${admin}', 'admin', 'Admin'), ('${member}', 'member', 'Member'), ('${contributor}', 'contributor', 'Contributor');
    insert into auth.mfa_factors values ('${admin}', 'totp', 'verified'), ('${member}', 'totp', 'verified');
    insert into auth.sessions values
      ('${adminSession}', '${admin}'),
      ('${memberSession}', '${member}'),
      ('${contributorSession}', '${contributor}');
  `);
  await db.exec(await readFile(new URL('../migrations/20260917172518_admin_totp_and_auth_audit.sql', import.meta.url), 'utf8'));
  const hardeningMigration = await readFile(
    new URL('../migrations/20260918015321_security_audit_hardening.sql', import.meta.url),
    'utf8',
  );
  await db.exec(hardeningMigration.slice(0, hardeningMigration.indexOf('-- Account creation')));
  await db.exec(`
    create table public.protected_admin_data (id int);
    insert into public.protected_admin_data values (1);
    alter table public.protected_admin_data enable row level security;
    grant select on public.protected_admin_data to authenticated;
    create policy admin_only on public.protected_admin_data to authenticated using (private.has_role('admin'));
    create policy admin_legacy_only on public.protected_admin_data to authenticated using (private.is_admin());
    insert into auth.audit_log_entries
    select gen_random_uuid(), now() - make_interval(secs => n), json_build_object('actor_id', '${admin}', 'action', 'login', 'traits', 'NEVER EXPOSE'), '203.0.113.7' from generate_series(1, 105) n;
    insert into auth.audit_log_entries values
      (gen_random_uuid(), now(), json_build_object('actor_id','${member}','action','login'), '203.0.113.8'),
      (gen_random_uuid(), now() - interval '91 days', json_build_object('actor_id','${admin}','action','login'), '203.0.113.9'),
      (gen_random_uuid(), now(), '{"actor_id":"not-a-uuid","action":"login"}', '203.0.113.10');
  `);
  const claims = async (sub, aal, method, sessionId) => {
    await db.exec('reset role');
    const defaultSession = sub === admin
      ? adminSession
      : sub === member
        ? memberSession
        : contributorSession;
    await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub, aal, session_id: sessionId ?? defaultSession, ...(method ? { amr: [{ method }] } : {}) })]);
    await db.exec('set role authenticated');
  };
  const allowed = async (role) => (await db.query('select private.has_role($1) as allowed', [role])).rows[0].allowed;
  const audit = () => db.query('select * from public.list_admin_auth_events()');
  await t.test('AAL1 denied, cumulative member/contributor rights retained', async () => {
    await claims(admin, 'aal1', 'password');
    assert.equal(await allowed('admin'), false);
    assert.equal((await db.query('select private.is_admin() as allowed')).rows[0].allowed, false);
    assert.equal(await allowed('contributor'), true);
    assert.equal(await allowed('member'), true);
    assert.equal((await db.query('select * from public.protected_admin_data')).rows.length, 0);
    await assert.rejects(audit, { code: '42501' });
  });
  await t.test('AAL2 phone and missing AMR denied even with registered TOTP', async () => {
    await claims(admin, 'aal2', 'phone'); assert.equal(await allowed('admin'), false);
    await claims(admin, 'aal2'); assert.equal(await allowed('admin'), false);
  });
  await t.test('AAL2 TOTP grants administrator access', async () => {
    await claims(admin, 'aal2', 'totp'); assert.equal(await allowed('admin'), true);
    assert.equal((await db.query('select public.has_admin_mfa() as ok')).rows[0].ok, true);
    assert.equal((await db.query('select * from public.protected_admin_data')).rows.length, 1);
    assert.equal(await allowed('unknown'), false);
  });
  await t.test('audit projects only safe fields, filters actors/time and pages', async () => {
    const { rows } = await audit(); assert.equal(rows.length, 100);
    assert.deepEqual(Object.keys(rows[0]), ['id', 'created_at', 'actor_id', 'actor_name', 'action', 'ip_address']);
    assert.ok(rows.every(r => r.actor_id === admin && r.ip_address === '203.0.113.7'));
    const next = await db.query('select * from public.list_admin_auth_events($1, $2)', [rows.at(-1).created_at, rows.at(-1).id]);
    assert.equal(next.rows.length, 5);
    await assert.rejects(() => db.query('select * from auth.audit_log_entries'), { code: '42501' });
  });
  await t.test('paired timestamp/id cursor preserves rows sharing a timestamp', async () => {
    await db.exec(`reset role; update auth.audit_log_entries set created_at = now() - interval '1 second' where ip_address = '203.0.113.7'; set role authenticated`);
    const { rows } = await audit(); assert.equal(rows.length, 100);
    const next = await db.query('select * from public.list_admin_auth_events($1, $2)', [rows.at(-1).created_at, rows.at(-1).id]);
    assert.equal(next.rows.length, 5);
    assert.equal(new Set([...rows, ...next.rows].map(row => row.id)).size, 105);
  });
  await t.test('removed or unverified factor invalidates still-AAL2 token', async () => {
    await db.exec("reset role; update auth.mfa_factors set status='unverified'; set role authenticated");
    assert.equal(await allowed('admin'), false);
    await db.exec("reset role; delete from auth.mfa_factors; set role authenticated");
    assert.equal(await allowed('admin'), false);
  });
  await t.test('revoked Auth session invalidates an otherwise valid admin token', async () => {
    await db.exec(`reset role; insert into auth.mfa_factors values ('${admin}', 'totp', 'verified'); set role authenticated`);
    await claims(admin, 'aal2', 'totp');
    assert.equal(await allowed('admin'), true);
    await db.exec(`reset role; delete from auth.sessions where id = '${adminSession}'; set role authenticated`);
    assert.equal(await allowed('admin'), false);
  });
  await t.test('member and contributor cannot access administrator audit', async () => {
    await claims(member, 'aal2', 'totp'); assert.equal(await allowed('admin'), false);
    assert.equal(await allowed('contributor'), false); assert.equal(await allowed('member'), true);
    await assert.rejects(audit, { code: '42501' });
    await claims(contributor, 'aal1', 'password'); assert.equal(await allowed('admin'), false);
    assert.equal(await allowed('contributor'), true); assert.equal(await allowed('member'), true);
    await assert.rejects(audit, { code: '42501' });
  });
  await t.test('null uid and anonymous role denied', async () => {
    await claims(null, 'aal2', 'totp'); assert.equal(await allowed('admin'), false); assert.equal(await allowed('member'), false);
    await db.exec('reset role; set role anon');
    await assert.rejects(() => db.query('select public.has_admin_mfa()'), { code: '42501' });
    await assert.rejects(audit, { code: '42501' });
  });
});
