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
function fixture({ role = 'admin', mfa = true, mfaError = null, validSession = true } = {}) {
  let handler;
  let clients = 0;
  let mfaChecks = 0;
  const userClient = {
    auth: { getUser: async () => ({ data: { user: validSession ? { id: 'admin-id' } : null }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role, is_admin: true }, error: null }) }) }) }),
    rpc: async (name) => { assert.equal(name, 'has_admin_mfa'); mfaChecks++; return { data: mfa, error: mfaError }; },
  };
  const serviceClient = { auth: { admin: { listUsers: async () => ({ data: { users: [] }, error: null }) } } };
  runInNewContext(bundle.outputFiles[0].text, {
    Request, Response, console,
    Deno: { env: { get: () => 'test' }, serve: (callback) => { handler = callback; } },
    testCreateClient: () => { clients++; return clients === 1 ? userClient : serviceClient; },
  });
  return {
    request: (method = 'POST') => handler(new Request('https://test.local/admin-users', {
      method, headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
      ...(method === 'POST' ? { body: JSON.stringify({ action: 'list' }) } : {}),
    })),
    counts: () => ({ clients, mfaChecks }),
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
  const f = fixture({ mfa: false }); assert.equal((await f.request()).status, 403); assert.deepEqual(f.counts(), { clients: 1, mfaChecks: 1 });
});
test('fails closed when MFA verification is unavailable', async () => {
  const f = fixture({ mfa: true, mfaError: { message: 'unavailable' } }); assert.equal((await f.request()).status, 403); assert.equal(f.counts().clients, 1);
});
test('allows administrative listing after role and MFA validation', async () => {
  const f = fixture(); const response = await f.request(); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { users: [] }); assert.deepEqual(f.counts(), { clients: 2, mfaChecks: 1 });
});
