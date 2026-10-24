// Actual bounded reader, synthetic streams only; no network transport.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({
  entryPoints: [new URL('../functions/_shared/requestBody.ts', import.meta.url).pathname],
  write: false, format: 'esm', platform: 'node',
});
const { readJsonObject } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const encode = (text) => new TextEncoder().encode(text);

test('real byte count refuses oversized streams without or with misleading Content-Length', async () => {
  for (const contentLength of [null, '1']) {
    let pulls = 0;
    let cancelled = false;
    const stream = new ReadableStream({
      pull(controller) { pulls++; controller.enqueue(encode('0123456789')); },
      cancel() { cancelled = true; },
    }, { highWaterMark: 0 });
    const request = new Request('https://synthetic.invalid', {
      method: 'POST', body: stream, duplex: 'half',
      headers: contentLength ? { 'Content-Length': contentLength } : {},
    });
    assert.deepEqual(await readJsonObject(request, 15), { data: null, error: 'too_large' });
    assert.equal(cancelled, true);
    assert.equal(pulls, 2, 'must stop reading at first over-limit chunk');
  }
});

test('accepts split UTF-8 at the exact byte boundary', async () => {
  const bytes = encode('{"texte":"é"}');
  let index = 0;
  const request = new Request('https://synthetic.invalid', {
    method: 'POST', duplex: 'half', body: new ReadableStream({
      pull(controller) {
        if (index === bytes.length) controller.close();
        else controller.enqueue(bytes.slice(index, ++index));
      },
    }),
  });
  assert.deepEqual(await readJsonObject(request, bytes.length), { data: { texte: 'é' }, error: null });
});

test('rejects null, arrays, primitives, malformed JSON and invalid UTF-8', async () => {
  for (const body of ['null', '[]', '1', '"text"', 'true', '{', '', new Uint8Array([123, 34, 120, 34, 58, 34, 255, 34, 125])]) {
    const request = new Request('https://synthetic.invalid', { method: 'POST', body });
    assert.deepEqual(await readJsonObject(request, 100), { data: null, error: 'invalid' });
  }
});
