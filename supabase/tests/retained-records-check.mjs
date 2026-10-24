// Synthetic PostgreSQL fixture; no remote Auth, Storage or personal data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE));
const migration = await readFile(new URL('../migrations/20261024162125_security_preserve_retained_records.sql', import.meta.url), 'utf8');
const resources = [
  ['medical_follow_ups', 'user_id', 'cascade'],
  ['main_courantes', 'user_id', 'cascade'],
  ['equipment_repair_requests', 'user_id', 'cascade'],
  ['admin_operation_audit', 'actor_id', 'set null'],
  ['training_audit_log', 'actor_id', 'set null'],
  ['document_audit_log', 'actor_id', 'set null'],
];
test('account deletion retains medical/forms/audit actors; unused account remains deletable', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create schema auth;
    create table auth.users(id uuid primary key);
    create table public.profiles(id uuid primary key references auth.users(id) on delete cascade);`);
  for (const [table, owner, action] of resources) {
    await db.exec(`create table public.${table}(id int primary key, ${owner} uuid references public.profiles(id) on delete ${action});`);
  }
  // Reproduce the original loss on the same fixture before the correction.
  const original = '00000000-0000-4000-8000-000000000001';
  await db.exec(`insert into auth.users values ('${original}'); insert into public.profiles values ('${original}');
    insert into public.medical_follow_ups values (0, '${original}'); delete from auth.users where id='${original}';`);
  assert.equal((await db.query('select count(*)::int as n from public.medical_follow_ups')).rows[0].n, 0);
  await db.exec(migration);
  await db.exec(migration); // Replay must preserve constraints and rows.
  for (const [i, [table, owner]] of resources.entries()) {
    const id = `10000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
    await db.exec(`insert into auth.users values ('${id}'); insert into public.profiles values ('${id}');
      insert into public.${table} values (1, '${id}');`);
    for (const parent of ['auth.users', 'public.profiles']) {
      await assert.rejects(db.exec(`delete from ${parent} where id='${id}'`),
        (error) => ['23001', '23503'].includes(error.code) && error.message.includes(`${table}_${owner}_fkey`));
      assert.equal((await db.query(`select ${owner} from public.${table} where id=1`)).rows[0][owner], id);
      assert.equal((await db.query(`select count(*)::int as n from auth.users where id='${id}'`)).rows[0].n, 1);
    }
  }
  const unused = '20000000-0000-4000-8000-000000000001';
  await db.exec(`insert into auth.users values ('${unused}'); insert into public.profiles values ('${unused}');
    delete from auth.users where id='${unused}';`);
  assert.equal((await db.query(`select count(*)::int as n from public.profiles where id='${unused}'`)).rows[0].n, 0);
  assert.equal((await db.query("select count(*)::int as n from pg_constraint where contype='f' and confdeltype='r'")).rows[0].n, 6);
});
