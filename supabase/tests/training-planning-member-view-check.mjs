import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PGLITE_MODULE;
if (!modulePath) throw new Error('Set PGLITE_MODULE to an installed PGlite module.');
const { PGlite } = await import(pathToFileURL(modulePath));
const migration = await readFile(
  new URL('../migrations/20260920065639_training_planning_member_view_only.sql', import.meta.url),
  'utf8',
);

test('members can view planning but cannot mutate training registrations or capacity', async (t) => {
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
    create function private.has_active_session() returns boolean language sql stable as $$
      select true
    $$;
    create function private.has_role(required_role text) returns boolean language sql stable as $$
      select case auth.jwt()->>'app_role'
        when 'admin' then true
        when 'contributor' then required_role in ('member', 'contributor')
        else required_role = 'member'
      end
    $$;
    create function private.is_admin() returns boolean language sql stable as $$
      select (auth.jwt()->>'app_role') = 'admin'
    $$;
    create table public.training_registrations (id uuid);
    create table public.events (id uuid, capacity integer);
    create function public.register_for_training(p_event_id uuid)
    returns public.training_registrations
    language plpgsql security definer set search_path = '' as $$
    declare current_user_id uuid := (select auth.uid());
    begin
      if current_user_id is null or not private.has_active_session() then
        raise exception 'Authentification requise';
      end if;
      return null;
    end;
    $$;
    create function public.cancel_training_registration(p_event_id uuid)
    returns void
    language plpgsql security definer set search_path = '' as $$
    declare current_user_id uuid := (select auth.uid());
    begin
      if current_user_id is null or not private.has_active_session() then
        raise exception 'Authentification requise';
      end if;
    end;
    $$;
    create function public.set_training_capacity(p_event_id uuid, p_capacity integer)
    returns void
    language plpgsql security definer set search_path = '' as $$
    declare current_user_id uuid := (select auth.uid());
    begin
      if current_user_id is null then
        raise exception 'Authentification requise';
      end if;
      if not (select private.is_admin()) then
        raise exception 'Action réservée aux responsables';
      end if;
    end;
    $$;
  `);

  await db.exec(migration);
  await db.exec(migration);

  await db.query(
    "select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ sub: '11111111-1111-4111-8111-111111111111', app_role: 'member' })],
  );
  await assert.rejects(
    () => db.query('select public.register_for_training($1)', ['22222222-2222-4222-8222-222222222222']),
    /contributeurs et administrateurs/,
  );
  await assert.rejects(
    () => db.query('select public.cancel_training_registration($1)', ['22222222-2222-4222-8222-222222222222']),
    /contributeurs et administrateurs/,
  );
  await assert.rejects(
    () => db.query('select public.set_training_capacity($1, $2)', [
      '22222222-2222-4222-8222-222222222222',
      20,
    ]),
    /contributeurs et administrateurs/,
  );

  await db.query(
    "select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ sub: '33333333-3333-4333-8333-333333333333', app_role: 'contributor' })],
  );
  await db.query('select public.register_for_training($1)', ['22222222-2222-4222-8222-222222222222']);
  await db.query('select public.cancel_training_registration($1)', ['22222222-2222-4222-8222-222222222222']);
  await db.query('select public.set_training_capacity($1, $2)', [
    '22222222-2222-4222-8222-222222222222',
    20,
  ]);
  assert.match(migration, /private\.has_role\(''contributor''\)/);
});
