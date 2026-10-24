// Executes the actual Edge handler with mocked Auth/DB transports; no network access.
// node --test supabase/tests/admin-api-check.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';

const bundle = await build({
  entryPoints: [new URL('../functions/admin-users/index.ts', import.meta.url).pathname],
  bundle: true, write: false, format: 'iife', platform: 'neutral',
  plugins: [{ name: 'mock-transport', setup(builder) {
    builder.onResolve({ filter: /^npm:/ }, () => ({ path: 'client', namespace: 'test' }));
    builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const createClient = globalThis.testCreateClient;' }));
  } }],
});
function fixture({
  role = 'admin',
  mfa = true,
  mfaError = null,
  validSession = true,
  auditError = null,
  auditErrors = null,
  profileUpsertError = null,
  cleanupError = null,
} = {}) {
  let handler;
  let clients = 0;
  let mfaChecks = 0;
  let deleteCalls = 0;
  let auditCalls = 0;
  const userClient = {
    auth: { getUser: async () => ({ data: { user: validSession ? { id: 'admin-id' } : null }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role, is_admin: true }, error: null }) }) }) }),
    rpc: async (name) => { assert.equal(name, 'has_admin_mfa'); mfaChecks++; return { data: mfa, error: mfaError }; },
  };
  const serviceClient = {
    auth: { admin: {
      listUsers: async () => ({ data: { users: [] }, error: null }),
      inviteUserByEmail: async () => ({ data: { user: { id: 'invited-user' } }, error: null }),
      getUserById: async () => ({ data: { user: { id: 'target-user' } }, error: null }),
      deleteUser: async () => { deleteCalls++; return { error: cleanupError }; },
    } },
    from: (table) => {
      if (table === 'admin_operation_audit') {
        return {
          insert: async () => ({
            error: Array.isArray(auditErrors)
              ? (auditErrors[auditCalls++] ?? null)
              : auditError,
          }),
        };
      }
      if (table === 'profiles') {
        return {
          upsert: async () => ({ error: profileUpsertError }),
          select: async () => ({
            data: [{ id: 'target-user', role: 'member', is_admin: false }],
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
  runInNewContext(bundle.outputFiles[0].text, {
    Request, Response, URL, TextEncoder, TextDecoder, console,
    Deno: { env: { get: () => 'test' }, serve: (callback) => { handler = callback; } },
    testCreateClient: () => { clients++; return clients === 1 ? userClient : serviceClient; },
  });
  return {
    request: (method = 'POST', body = { action: 'list' }) => handler(new Request('https://test.local/admin-users', {
      method, headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
      ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
    })),
    counts: () => ({ clients, mfaChecks, deleteCalls }),
  };
}

test('rejects unsupported methods before authentication', async () => {
  const f = fixture(); assert.equal((await f.request('GET')).status, 405); assert.equal(f.counts().clients, 0);
});
test('rejects an invalid session without creating privileged client', async () => {
  const f = fixture({ validSession: false }); assert.equal((await f.request()).status, 401); assert.equal(f.counts().clients, 1);
});
test('rejects member even if legacy is_admin is true', async () => {
  const f = fixture({ role: 'member' }); assert.equal((await f.request()).status, 403); assert.equal(f.counts().clients, 1);
});
test('rejects an administrator without TOTP before any service-role operation', async () => {
  const f = fixture({ mfa: false }); assert.equal((await f.request()).status, 403); assert.deepEqual(f.counts(), { clients: 1, mfaChecks: 1, deleteCalls: 0 });
});
test('fails closed when MFA verification is unavailable', async () => {
  const f = fixture({ mfa: true, mfaError: { message: 'unavailable' } }); assert.equal((await f.request()).status, 403); assert.equal(f.counts().clients, 1);
});
test('allows administrative listing after role and MFA validation', async () => {
  const f = fixture(); const response = await f.request(); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { page: 1, perPage: 100, hasMore: false, users: [] }); assert.deepEqual(f.counts(), { clients: 2, mfaChecks: 1, deleteCalls: 0 });
});
test('does not reflect an invalid destination in the public error', async () => {
  const f = fixture();
  const response = await f.request('POST', {
    action: 'update_email_destinations',
    destinations: [
      { form_key: 'main_courante', recipients: ['attacker@example.fr?bcc=leak@example.net'] },
      { form_key: 'suivi_medical', recipients: ['medical@example.invalid'] },
      { form_key: 'demande_reparation', recipients: ['repairs@example.invalid'] },
    ],
  });
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error, 'Une adresse de destinataire est invalide.');
  assert.doesNotMatch(body.error, /attacker@example\.fr/);
});
test('fails closed before a mutation when the business audit is unavailable', async () => {
  const f = fixture({ auditError: { message: 'unavailable' } });
  const response = await f.request('POST', { action: 'delete', userId: 'target-user' });
  assert.equal(response.status, 503);
  assert.equal(f.counts().deleteCalls, 0);
});
test('surfaces a reconciliation state when the success audit is unavailable', async () => {
  const f = fixture({ auditErrors: [null, { message: 'success audit unavailable' }] });
  const response = await f.request('POST', { action: 'delete', userId: 'target-user' });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: 'Opération effectuée, mais sa journalisation doit être réconciliée.',
    code: 'audit_pending',
    operationCompleted: true,
  });
  assert.equal(f.counts().deleteCalls, 1);
});
test('reports an intervention when profile creation and compensation both fail', async () => {
  const f = fixture({
    profileUpsertError: { message: 'profile write failed' },
    cleanupError: { message: 'cleanup failed' },
  });
  const response = await f.request('POST', {
    action: 'invite',
    email: 'person@example.invalid',
    firstName: 'Synthetic',
    lastName: 'User',
    role: 'member',
    trainerLevels: ['RSFR'],
    redirectTo: 'https://app.flashover78.com/login',
  });
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /intervention est requise/);
  assert.equal(f.counts().deleteCalls, 1);
});
