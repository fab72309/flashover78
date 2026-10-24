// Real medical table, owner trigger, column grants and RLS excerpts run in
// isolated PostgreSQL. Auth JWT/uid and Auth tables are minimal fixtures;
// this does not exercise the Supabase gateway, Auth service or production.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PGLITE_MODULE;
if (!modulePath) throw new Error('Set PGLITE_MODULE to an installed PGlite module.');
const { PGlite } = await import(pathToFileURL(modulePath));
const loadMigration = (name) => readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8');
const [initial, editable, hardening, activeSession] = await Promise.all([
  loadMigration('20260912120648_medical_follow_ups.sql'),
  loadMigration('20260912151110_medical_follow_up_function_edit_pdf.sql'),
  loadMigration('20260918015321_security_audit_hardening.sql'),
  loadMigration('20260919090000_active_session_rls.sql'),
]);

function excerpt(source, start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first + start.length);
  assert.notEqual(first, -1, `Missing SQL marker: ${start}`);
  assert.notEqual(last, -1, `Missing SQL marker: ${end}`);
  return source.slice(first, last);
}

const ownerOne = '11111111-1111-4111-8111-111111111111';
const ownerTwo = '22222222-2222-4222-8222-222222222222';
const unqualified = '33333333-3333-4333-8333-333333333333';

async function asUser(db, userId) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub: userId, session_id: userId, role: 'authenticated' }),
  ]);
  await db.exec('set role authenticated');
}

async function insertMedical(db, owner, level = 'RSFR') {
  return db.query(`
    insert into public.medical_follow_ups (
      user_id, trainer_level, nom_formateur, prenom_formateur, email_formateur,
      date_formation, journee, conditions_meteo,
      hydratation_avant_bruleage, hydratation_apres_bruleage, lieu_formation,
      formation, role_formateur, type_bruleage, temps_ari,
      decontamination_post_bruleage, douche_dans_heure, observations_post_bruleage
    ) values (
      $1, $2, 'Forged', 'Forged', 'forged@example.invalid',
      current_date, 'Matin', 'Pluie', '0 l', '0 l', 'MLB TdL',
      'FI', $2, 'Tableau de bord', '30', 'NON', 'Non', array['Rien à signaler']
    ) returning id, user_id, nom_formateur, prenom_formateur, email_formateur
  `, [owner, level]);
}

test('medical owner isolation, explicit qualification and 72h window execute in PostgreSQL', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema private;
    grant usage on schema auth, private to authenticated;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
    $$;
    create function auth.uid() returns uuid language sql stable as $$
      select (auth.jwt()->>'sub')::uuid
    $$;
    create table auth.users (id uuid primary key, email text not null);
    create table auth.sessions (id uuid primary key, user_id uuid not null);
    create table public.profiles (
      id uuid primary key references auth.users(id), first_name text, last_name text,
      display_name text, trainer_levels text[] not null default '{}'
    );
    insert into auth.users values
      ('${ownerOne}', 'owner1@example.invalid'),
      ('${ownerTwo}', 'owner2@example.invalid'),
      ('${unqualified}', 'member@example.invalid');
    insert into auth.sessions select id, id from auth.users;
    insert into public.profiles values
      ('${ownerOne}', 'First', 'Owner', 'First Owner', array['RSFR']),
      ('${ownerTwo}', 'Second', 'Owner', 'Second Owner', array['FOR BAT']),
      ('${unqualified}', 'Unqualified', 'Member', 'Unqualified Member', '{}');
  `);
  // Entire original medical migrations, not reimplementations of their logic.
  await db.exec(initial);
  await db.exec(editable);
  await db.exec(excerpt(hardening,
    'create or replace function private.has_active_session()',
    'create or replace function private.has_admin_mfa()'));
  await db.exec('grant execute on function private.has_active_session() to authenticated');
  await db.exec(excerpt(activeSession,
    'alter policy "medical_follow_ups_select_own"',
    'alter policy "main_courantes_select_own"'));

  let firstId;
  let secondId;
  await t.test('two qualified owners insert and identity is read from their account', async () => {
    await asUser(db, ownerOne);
    const first = (await insertMedical(db, ownerOne)).rows[0];
    firstId = first.id;
    assert.deepEqual({ ...first, id: undefined }, {
      id: undefined, user_id: ownerOne, nom_formateur: 'Owner',
      prenom_formateur: 'First', email_formateur: 'owner1@example.invalid',
    });
    await asUser(db, ownerTwo);
    const second = (await insertMedical(db, ownerTwo, 'FOR BAT')).rows[0];
    secondId = second.id;
    assert.equal(second.email_formateur, 'owner2@example.invalid');
  });

  await t.test('cross-owner reads and writes are denied by RLS', async () => {
    await asUser(db, ownerOne);
    assert.deepEqual((await db.query('select id from medical_follow_ups')).rows, [{ id: firstId }]);
    const result = await db.query('update medical_follow_ups set observations = $1 where id = $2 returning id', ['cross-owner', secondId]);
    assert.equal(result.rows.length, 0);
    await assert.rejects(() => insertMedical(db, ownerTwo), /doit appartenir/);
    await asUser(db, ownerTwo);
    assert.deepEqual((await db.query('select id from medical_follow_ups')).rows, [{ id: secondId }]);
  });

  await t.test('unqualified member and wrong explicit qualification are rejected', async () => {
    await asUser(db, unqualified);
    await assert.rejects(() => insertMedical(db, unqualified), /fonction sélectionnée/);
    await asUser(db, ownerOne);
    await assert.rejects(() => insertMedical(db, ownerOne, 'FOR BAT'), /fonction sélectionnée/);
  });

  await t.test('owner cannot move a medical record to another account', async () => {
    await asUser(db, ownerOne);
    await assert.rejects(() => db.query('update medical_follow_ups set user_id = $1 where id = $2', [ownerTwo, firstId]), /doit appartenir|ne peut pas être déplacée/);
    await assert.rejects(() => db.query('update medical_follow_ups set created_at = now() where id = $1', [firstId]), /permission denied/);
  });

  await t.test('owner update succeeds before and exactly at 72h in a fixed PostgreSQL transaction', async () => {
    await asUser(db, ownerOne);
    const withinWindow = await db.query('update medical_follow_ups set observations = $1 where id = $2 returning observations', ['within 72 hours', firstId]);
    assert.deepEqual(withinWindow.rows, [{ observations: 'within 72 hours' }]);
    await db.exec('reset role; begin');
    try {
      await db.query("update medical_follow_ups set created_at = timezone('utc', now()) - interval '72 hours' where id = $1", [firstId]);
      await asUser(db, ownerOne);
      const updated = await db.query('update medical_follow_ups set observations = $1 where id = $2 returning observations', ['at 72 hours', firstId]);
      assert.deepEqual(updated.rows, [{ observations: 'at 72 hours' }]);
      await db.exec('commit');
    } catch (error) {
      await db.exec('rollback');
      throw error;
    }
  });

  await t.test('owner update fails after 72h and leaves previous data intact', async () => {
    await db.exec('reset role');
    await db.query("update medical_follow_ups set created_at = timezone('utc', now()) - interval '72 hours 1 second' where id = $1", [firstId]);
    await asUser(db, ownerOne);
    await assert.rejects(() => db.query('update medical_follow_ups set observations = $1 where id = $2', ['after deadline', firstId]), /72 heures est dépassée/);
    assert.equal((await db.query('select observations from medical_follow_ups where id = $1', [firstId])).rows[0].observations, 'at 72 hours');
  });

  await t.test('revoked session cannot read, insert or update despite unchanged JWT', async () => {
    await asUser(db, ownerTwo);
    assert.equal((await db.query('select id from medical_follow_ups')).rows.length, 1);
    await db.exec('reset role');
    await db.query('delete from auth.sessions where user_id = $1', [ownerTwo]);
    await db.exec('set role authenticated');
    assert.equal((await db.query('select id from medical_follow_ups')).rows.length, 0);
    assert.equal((await db.query('update medical_follow_ups set observations = $1 where id = $2 returning id', ['revoked', secondId])).rows.length, 0);
    await assert.rejects(() => insertMedical(db, ownerTwo, 'FOR BAT'), /row-level security/);
    // The other live session is unaffected.
    await asUser(db, ownerOne);
    assert.deepEqual((await db.query('select id from medical_follow_ups')).rows, [{ id: firstId }]);
  });
});
