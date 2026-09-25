// Executes the three form-email handlers with synthetic transports. The
// revoked-session case must fail before parsing or processing the PDF payload.
// node --test supabase/tests/email-functions-check.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const FUNCTIONS = [
  {
    name: 'medical-follow-up-email',
    activeMessage: 'Suivi médical introuvable.',
  },
  {
    name: 'main-courante-email',
    activeMessage: 'La main courante à envoyer est invalide.',
  },
  {
    name: 'equipment-repair-email',
    activeMessage: 'La demande de réparation à envoyer est invalide.',
  },
];

async function bundleFor(functionName) {
  const entryPoint = new URL(`../functions/${functionName}/index.ts`, import.meta.url).pathname;
  const result = await build({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'node',
    plugins: [{
      name: 'mock-transport',
      setup(builder) {
        builder.onResolve({ filter: /^npm:@supabase\// }, () => ({ path: 'client', namespace: 'test' }));
        builder.onResolve({ filter: /^npm:pdf-lib@/ }, () => ({ path: require.resolve('pdf-lib') }));
        builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
          contents: 'export const createClient = globalThis.testCreateClient;',
        }));
      },
    }],
  });
  return result.outputFiles[0].text;
}

function fixture(bundle, { active }) {
  let handler;
  const calls = [];
  const userClient = {
    auth: {
      getUser: async () => ({ data: { user: { id: '11111111-1111-4111-8111-111111111111', email: 'synthetic@example.test' } }, error: null }),
    },
    rpc: async (name) => {
      calls.push(name);
      if (name === 'require_active_session') {
        return active ? { data: true, error: null } : { data: null, error: new Error('revoked') };
      }
      throw new Error(`Unexpected RPC ${name}`);
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    }),
  };
  const serviceClient = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    }),
  };
  const clientFactory = (_url, _key, options = {}) => (
    options.global?.headers?.Authorization ? userClient : serviceClient
  );

  runInNewContext(bundle, {
    Request,
    Response,
    Blob,
    TextEncoder,
    TextDecoder,
    URL,
    atob,
    console,
    fetch: async () => {
      throw new Error('Brevo must not be reached in this harness');
    },
    Deno: {
      env: {
        get: (name) => ({
          SUPABASE_URL: 'https://synthetic.supabase.invalid',
          SUPABASE_ANON_KEY: 'synthetic-anon',
          SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-role',
        }[name] ?? ''),
      },
      serve: (callback) => { handler = callback; },
    },
    testCreateClient: clientFactory,
  });

  return {
    calls,
    request: (body) => handler(new Request('https://worker.invalid/form-email', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer synthetic-user-token',
        Origin: 'http://localhost:5173',
        'Content-Type': 'application/json',
      },
      body,
    })),
  };
}

for (const { name: functionName, activeMessage } of FUNCTIONS) {
  const bundle = await bundleFor(functionName);

  test(`${functionName} rejects a revoked session before processing the payload`, async () => {
    const harness = fixture(bundle, { active: false });
    const response = await harness.request('{not-json');
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'Session invalide ou révoquée.' });
    assert.deepEqual(harness.calls, ['require_active_session']);
  });

  test(`${functionName} reaches the authenticated submission check with an active session`, async () => {
    const harness = fixture(bundle, { active: true });
    const response = await harness.request(functionName === 'medical-follow-up-email'
      ? JSON.stringify({ submissionId: '11111111-1111-4111-8111-111111111111' })
      : '{}');
    assert.equal(response.status, functionName === 'medical-follow-up-email' ? 404 : 400);
    assert.deepEqual(await response.json(), { error: activeMessage });
    assert.deepEqual(harness.calls, ['require_active_session']);
  });
}
