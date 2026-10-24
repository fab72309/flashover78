import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';

const bundle = await build({
  entryPoints: [new URL('../functions/storage-cleanup-worker/index.ts', import.meta.url).pathname],
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'neutral',
  plugins: [{
    name: 'mock-transport',
    setup(builder) {
      builder.onResolve({ filter: /^npm:/ }, () => ({ path: 'client', namespace: 'test' }));
      builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
        contents: 'export const createClient = globalThis.testCreateClient;',
      }));
    },
  }],
});

function fixture({ removeError = null, reference = false, claimShouldDelete = !reference } = {}) {
  let handler;
  let clients = 0;
  const calls = [];
  const client = {
    rpc: async (name, args) => {
      calls.push([name, args]);
      if (name === 'claim_storage_cleanup_batch') {
        return {
          data: [{
            id: '11111111-1111-4111-8111-111111111111',
            bucket_id: 'resources',
            storage_path: '11111111-1111-4111-8111-111111111111/file.pdf',
            should_delete: claimShouldDelete,
          }],
          error: null,
        };
      }
      if (name === 'storage_cleanup_is_referenced') return { data: reference, error: null };
      if (name === 'complete_storage_cleanup') return { data: true, error: null };
      throw new Error(`Unexpected RPC ${name}`);
    },
    storage: {
      from: (bucket) => ({
        remove: async (paths) => {
          calls.push(['remove', bucket, paths]);
          return { data: [], error: removeError };
        },
      }),
    },
  };

  runInNewContext(bundle.outputFiles[0].text, {
    Request,
    Response,
    TextEncoder,
    TextDecoder,
    URL,
    console,
    Deno: {
      env: {
        get: (name) => ({
          STORAGE_CLEANUP_WORKER_SECRET: 'synthetic-worker-secret',
          SUPABASE_URL: 'https://synthetic.supabase.invalid',
          SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-role',
        }[name] ?? ''),
      },
      serve: (callback) => { handler = callback; },
    },
    testCreateClient: () => { clients += 1; return client; },
  });

  return {
    request: (headers = {}, body = { limit: 10 }) => handler(new Request('https://worker.invalid/storage-cleanup-worker', {
      method: 'POST',
      headers: { 'x-storage-cleanup-token': 'synthetic-worker-secret', ...headers },
      body: JSON.stringify(body),
    })),
    calls: () => calls,
    clients: () => clients,
  };
}

test('worker requires its dedicated token and processes a successful deletion', async () => {
  const f = fixture();
  const response = await f.request();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { claimed: 1, deleted: 1, skippedReferenced: 0, failed: 0 });
  assert.equal(f.clients(), 1);
  assert.ok(f.calls().some(([name]) => name === 'remove'));
  assert.ok(f.calls().some(([name, args]) => name === 'complete_storage_cleanup' && args.p_succeeded === true));
});

test('worker skips a re-referenced object without deleting it', async () => {
  const f = fixture({ reference: true });
  const response = await f.request();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { claimed: 1, deleted: 0, skippedReferenced: 1, failed: 0 });
  assert.equal(f.calls().some(([name]) => name === 'remove'), false);
});

test('worker keeps a stale claim queued when its reference disappears', async () => {
  const f = fixture({ claimShouldDelete: false, reference: false });
  const response = await f.request();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { claimed: 1, deleted: 0, skippedReferenced: 0, failed: 1 });
  assert.ok(f.calls().some(([name, args]) => name === 'complete_storage_cleanup' && args.p_succeeded === false));
  assert.equal(f.calls().some(([name]) => name === 'remove'), false);
});

test('worker records a failed Storage deletion for retry', async () => {
  const f = fixture({ removeError: { message: 'synthetic storage failure' } });
  const response = await f.request();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { claimed: 1, deleted: 0, skippedReferenced: 0, failed: 1 });
  assert.ok(f.calls().some(([name, args]) => name === 'complete_storage_cleanup' && args.p_succeeded === false));
});

test('worker refuses an invalid token before creating a Supabase client', async () => {
  const f = fixture();
  const response = await f.request({ 'x-storage-cleanup-token': 'wrong' });
  assert.equal(response.status, 401);
  assert.equal(f.clients(), 0);
});

test('worker accepts the service-role bearer for native gateway JWT verification', async () => {
  const f = fixture();
  const response = await f.request({
    'x-storage-cleanup-token': '',
    Authorization: 'Bearer synthetic-service-role',
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { claimed: 1, deleted: 1, skippedReferenced: 0, failed: 0 });
  assert.equal(f.clients(), 1);
});
