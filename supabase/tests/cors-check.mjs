import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const functions = [
  'admin-users',
  'medical-follow-up-email',
  'main-courante-email',
  'equipment-repair-email',
  'store-form-pdf',
  'store-document',
];
const pdfSanitizingFunctions = new Set([
  'medical-follow-up-email',
  'main-courante-email',
  'equipment-repair-email',
  'store-form-pdf',
  'store-document',
]);

test('sensitive Edge Functions use an origin allowlist instead of wildcard CORS', async () => {
  for (const name of functions) {
    const source = await readFile(new URL(`../functions/${name}/index.ts`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /Access-Control-Allow-Origin['"]?\s*:\s*['"]\*['"]/);
    assert.match(source, /rejectDisallowedOrigin/);
    assert.match(source, /preflightResponse/);
    if (pdfSanitizingFunctions.has(name)) {
      assert.match(source, /sanitizePdf/);
    }
  }

  const cors = await readFile(new URL('../functions/_shared/cors.ts', import.meta.url), 'utf8');
  assert.match(cors, /APP_ALLOWED_ORIGINS/);
  assert.match(cors, /https:\/\/app\.flashover78\.com/);
  assert.match(cors, /status: 403/);
});
