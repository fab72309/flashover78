import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';

const require = createRequire(import.meta.url);
const validPdf = await PDFDocument.create();
const validPage = validPdf.addPage();
validPage.drawText('synthetic form');
const validCatalog = validPdf.context.lookup(validPdf.context.trailerInfo.Root);
validCatalog.set(PDFName.of('OpenAction'), PDFString.of('javascript:app.alert(1)'));
validPage.node.set(PDFName.of('AA'), PDFString.of('/JavaScript'));
const validPdfBytes = await validPdf.save();

const bundle = await build({
  entryPoints: [new URL('../functions/store-form-pdf/index.ts', import.meta.url).pathname],
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'node',
  mainFields: ['module', 'main'],
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

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SUBMISSION_ID = '22222222-2222-4222-8222-222222222222';
const PDF_BASE64 = Buffer.from(validPdfBytes).toString('base64');

function fixture({ active = true, approval = true, cleanupError = null } = {}) {
  let handler;
  const calls = [];
  const clientFactory = (_url, _key, options = {}) => {
    const isUserClient = Boolean(options.global?.headers?.Authorization);
    return {
      auth: {
        getUser: async () => isUserClient
          ? { data: { user: { id: USER_ID } }, error: null }
          : { data: { user: null }, error: null },
      },
      rpc: async (name, args) => {
        calls.push(['rpc', name, args, isUserClient]);
        if (name === 'require_active_session') {
          return active ? { data: true, error: null } : { data: null, error: new Error('revoked') };
        }
        if (name === 'register_form_pdf_approval') {
          return approval ? { data: true, error: null } : { data: null, error: new Error('approval failed') };
        }
        if (name === 'enqueue_storage_cleanup_service_role') {
          return { data: true, error: null };
        }
        throw new Error(`Unexpected RPC ${name}`);
      },
      storage: {
        from: (bucket) => ({
          upload: async (path, file, options) => {
            calls.push(['upload', bucket, path, file.size, options, file]);
            return { data: { path }, error: null };
          },
          remove: async (paths) => {
            calls.push(['remove', bucket, paths]);
            return { data: [], error: cleanupError };
          },
        }),
      },
    };
  };

  runInNewContext(bundle.outputFiles[0].text, {
    Request,
    Response,
    Blob,
    TextEncoder,
    TextDecoder,
    URL,
    atob,
    console,
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
    request: (body) => handler(new Request('https://worker.invalid/store-form-pdf', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer synthetic-user-token',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify(body),
    })),
    calls: () => calls,
  };
}

test('finalizer validates bytes, uploads server-side and registers a one-time approval', async () => {
  const f = fixture();
  const response = await f.request({
    formKey: 'main_courante',
    submissionId: SUBMISSION_ID,
    filename: 'main-courante.pdf',
    documentBase64: PDF_BASE64,
  });
  assert.equal(response.status, 200);
  const responseBody = await response.json();
  assert.equal(responseBody.bucketId, 'main-courantes');
  assert.equal(responseBody.storagePath, `${USER_ID}/${SUBMISSION_ID}/main-courante.pdf`);
  assert.equal(responseBody.filename, 'main-courante.pdf');
  assert.equal(responseBody.fileSize, f.calls().find(([kind]) => kind === 'upload')[3]);
  assert.ok(responseBody.fileSize > 0);
  const uploadedFile = f.calls().find(([kind]) => kind === 'upload')[5];
  const uploadedText = Buffer.from(await uploadedFile.arrayBuffer()).toString('latin1');
  assert.doesNotMatch(uploadedText, /OpenAction|JavaScript|javascript|\/AA/i);
  /* assert the response contract without depending on pdf-lib's serializer size */
  assert.deepEqual({
    bucketId: responseBody.bucketId,
    storagePath: responseBody.storagePath,
    filename: responseBody.filename,
  }, {
    bucketId: 'main-courantes',
    storagePath: `${USER_ID}/${SUBMISSION_ID}/main-courante.pdf`,
    filename: 'main-courante.pdf',
  });
  assert.ok(f.calls().some(([kind]) => kind === 'upload'));
  assert.ok(f.calls().some(([kind, name]) => kind === 'rpc' && name === 'register_form_pdf_approval'));
});

test('finalizer rejects forged PDF bytes before Storage upload', async () => {
  const f = fixture();
  const response = await f.request({
    formKey: 'demande_reparation',
    submissionId: SUBMISSION_ID,
    filename: 'demande.pdf',
    documentBase64: Buffer.from('<html>not a pdf</html>').toString('base64'),
  });
  assert.equal(response.status, 422);
  assert.equal(f.calls().some(([kind]) => kind === 'upload'), false);
});

test('finalizer rejects a revoked session before Storage upload', async () => {
  const f = fixture({ active: false });
  const response = await f.request({
    formKey: 'main_courante',
    submissionId: SUBMISSION_ID,
    filename: 'main-courante.pdf',
    documentBase64: PDF_BASE64,
  });
  assert.equal(response.status, 401);
  assert.equal(f.calls().some(([kind]) => kind === 'upload'), false);
});

test('finalizer removes an object if the approval cannot be registered', async () => {
  const f = fixture({ approval: false });
  const response = await f.request({
    formKey: 'main_courante',
    submissionId: SUBMISSION_ID,
    filename: 'main-courante.pdf',
    documentBase64: PDF_BASE64,
  });
  assert.equal(response.status, 503);
  assert.ok(f.calls().some(([kind]) => kind === 'remove'));
});

test('finalizer queues cleanup when Storage removal also fails', async () => {
  const f = fixture({ approval: false, cleanupError: { message: 'synthetic remove failure' } });
  const response = await f.request({
    formKey: 'main_courante',
    submissionId: SUBMISSION_ID,
    filename: 'main-courante.pdf',
    documentBase64: PDF_BASE64,
  });
  assert.equal(response.status, 503);
  assert.ok(f.calls().some(([kind, name]) => kind === 'rpc' && name === 'enqueue_storage_cleanup_service_role'));
});
