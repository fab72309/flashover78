import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { PDFDocument } from 'pdf-lib';
import { zipSync } from 'fflate';

const require = createRequire(import.meta.url);
const pdf = await PDFDocument.create();
pdf.addPage().drawText('synthetic catalogue document');
const pdfBytes = await pdf.save();
const docxBytes = zipSync({
  '[Content_Types].xml': new TextEncoder().encode('<Types/>'),
  'word/document.xml': new TextEncoder().encode('<document/>'),
});

const bundle = await build({
  entryPoints: [new URL('../functions/store-document/index.ts', import.meta.url).pathname],
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'node',
  mainFields: ['module', 'main'],
  plugins: [{
    name: 'mock-transport',
    setup(builder) {
      builder.onResolve({ filter: /^npm:@supabase\// }, () => ({ path: 'client', namespace: 'test' }));
      builder.onResolve({ filter: /^npm:fflate@/ }, () => ({ path: require.resolve('fflate') }));
      builder.onResolve({ filter: /^npm:pdf-lib@/ }, () => ({ path: require.resolve('pdf-lib') }));
      builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
        contents: 'export const createClient = globalThis.testCreateClient;',
      }));
    },
  }],
});

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PDF_BASE64 = Buffer.from(pdfBytes).toString('base64');
const DOCX_BASE64 = Buffer.from(docxBytes).toString('base64');

function fixture({ contributor = true, approval = true, cleanupError = null } = {}) {
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
        if (name === 'require_contributor_session') {
          return contributor ? { data: true, error: null } : { data: null, error: new Error('denied') };
        }
        if (name === 'register_document_upload_approval') {
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
    Uint8Array,
    URL,
    atob,
    console,
    Set,
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
    request: (body) => handler(new Request('https://worker.invalid/store-document', {
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

test('document finalizer validates PDF bytes and registers an approval', async () => {
  const f = fixture();
  const response = await f.request({
    bucketId: 'sdis78-documents',
    storagePath: `${USER_ID}/catalog/new/document.pdf`,
    documentBase64: PDF_BASE64,
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.bucketId, 'sdis78-documents');
  assert.equal(body.mimeType, 'application/pdf');
  assert.equal(body.fileSize, f.calls().find(([kind]) => kind === 'upload')[3]);
  assert.ok(f.calls().some(([kind, name]) => kind === 'rpc' && name === 'register_document_upload_approval'));
});

test('document finalizer accepts a structurally valid DOCX without trusting the MIME alone', async () => {
  const f = fixture();
  const response = await f.request({
    bucketId: 'resources',
    storagePath: `${USER_ID}/catalog/new/document.docx`,
    documentBase64: DOCX_BASE64,
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.mimeType, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

  const macroFixture = fixture();
  const macroBytes = zipSync({
    '[Content_Types].xml': new TextEncoder().encode('<Types/>'),
    'word/document.xml': new TextEncoder().encode('<document/>'),
    'word/vbaProject.bin': new Uint8Array([1, 2, 3]),
  });
  const macroResponse = await macroFixture.request({
    bucketId: 'resources',
    storagePath: `${USER_ID}/catalog/new/macro.docx`,
    documentBase64: Buffer.from(macroBytes).toString('base64'),
  });
  assert.equal(macroResponse.status, 422);
});

test('document finalizer rejects new legacy OLE Office uploads before Storage', async () => {
  const legacyBytes = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00]);
  for (const extension of ['doc', 'ppt']) {
    const f = fixture();
    const response = await f.request({
      bucketId: 'resources',
      storagePath: `${USER_ID}/catalog/new/legacy.${extension}`,
      documentBase64: Buffer.from(legacyBytes).toString('base64'),
    });
    assert.equal(response.status, 400);
    assert.equal(f.calls().some(([kind]) => kind === 'upload'), false);
  }
});

test('document finalizer rejects external OOXML relationships before Storage upload', async () => {
  const f = fixture();
  const externalBytes = zipSync({
    '[Content_Types].xml': new TextEncoder().encode('<Types/>'),
    'word/document.xml': new TextEncoder().encode('<document/>'),
    'word/_rels/document.xml.rels': new TextEncoder().encode(
      '<Relationship TargetMode="External" Target="https://example.invalid"/>',
    ),
  });
  const response = await f.request({
    bucketId: 'resources',
    storagePath: `${USER_ID}/catalog/new/external.docx`,
    documentBase64: Buffer.from(externalBytes).toString('base64'),
  });
  assert.equal(response.status, 422);
  assert.equal(f.calls().some(([kind]) => kind === 'upload'), false);
});

test('document finalizer rejects ZIP package path traversal before Storage upload', async () => {
  const f = fixture();
  const traversalBytes = zipSync({
    '[Content_Types].xml': new TextEncoder().encode('<Types/>'),
    'word/document.xml': new TextEncoder().encode('<document/>'),
    '../outside.txt': new TextEncoder().encode('not part of the package'),
  });
  const response = await f.request({
    bucketId: 'resources',
    storagePath: `${USER_ID}/catalog/new/traversal.docx`,
    documentBase64: Buffer.from(traversalBytes).toString('base64'),
  });
  assert.equal(response.status, 422);
  assert.equal(f.calls().some(([kind]) => kind === 'upload'), false);
});

test('document finalizer rejects forged DOCX bytes before Storage upload', async () => {
  const f = fixture();
  const response = await f.request({
    bucketId: 'resources',
    storagePath: `${USER_ID}/catalog/new/document.docx`,
    documentBase64: Buffer.from('<html>not a docx</html>').toString('base64'),
  });
  assert.equal(response.status, 422);
  assert.equal(f.calls().some(([kind]) => kind === 'upload'), false);
});

test('document finalizer requires a current contributor session', async () => {
  const f = fixture({ contributor: false });
  const response = await f.request({
    bucketId: 'resources',
    storagePath: `${USER_ID}/catalog/new/document.txt`,
    documentBase64: Buffer.from('synthetic text').toString('base64'),
  });
  assert.equal(response.status, 403);
  assert.equal(f.calls().some(([kind]) => kind === 'upload'), false);
});

test('document finalizer queues cleanup when approval fails and Storage removal fails', async () => {
  const f = fixture({ approval: false, cleanupError: { message: 'synthetic remove failure' } });
  const response = await f.request({
    bucketId: 'resources',
    storagePath: `${USER_ID}/catalog/new/document.txt`,
    documentBase64: Buffer.from('synthetic text').toString('base64'),
  });
  assert.equal(response.status, 503);
  assert.ok(f.calls().some(([kind]) => kind === 'remove'));
  assert.ok(f.calls().some(([kind, name]) => kind === 'rpc' && name === 'enqueue_storage_cleanup_service_role'));
});
