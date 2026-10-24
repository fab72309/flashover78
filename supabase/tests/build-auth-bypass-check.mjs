// Actual Vite bundle of the auth guard; no browser, credentials or network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { build } from 'vite';

test('Vite builds never embed auth bypass, even with NODE_ENV development and explicit flag', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousFlag = process.env.VITE_DEV_AUTH_BYPASS;
  process.env.NODE_ENV = 'development';
  process.env.VITE_DEV_AUTH_BYPASS = 'true';
  try {
    const result = await build({
      configFile: resolve('vite.config.ts'),
      mode: 'test',
      logLevel: 'silent',
      build: {
        write: false,
        minify: false,
        lib: { entry: resolve('src/utils/devAuth.ts'), formats: ['es'] },
      },
    });
    const bundles = Array.isArray(result) ? result : [result];
    const chunk = bundles.flatMap((bundle) => bundle.output)
      .find((output) => output.type === 'chunk' && output.isEntry);
    assert.ok(chunk);
    const module = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
    assert.equal(module.isDevAuthBypassEnabled, false);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousFlag === undefined) delete process.env.VITE_DEV_AUTH_BYPASS;
    else process.env.VITE_DEV_AUTH_BYPASS = previousFlag;
  }
});
