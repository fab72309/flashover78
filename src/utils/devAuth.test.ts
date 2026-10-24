import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('explicit development auth bypass', () => {
  it.each([
    { mode: 'production', dev: false, prod: true, flag: 'true', host: 'localhost', expected: false },
    { mode: 'production', dev: false, prod: true, flag: 'true', host: '127.0.0.1', expected: false },
    { mode: 'test', dev: false, prod: true, flag: 'true', host: 'app.flashover78.com', expected: false },
    { mode: 'test', dev: false, prod: true, flag: 'false', host: 'app.flashover78.com', expected: false },
    { mode: 'test', dev: true, prod: false, flag: 'false', host: 'localhost', expected: false },
    { mode: 'development', dev: true, prod: false, flag: '', host: 'localhost', expected: false },
    { mode: 'development', dev: true, prod: false, flag: 'true', host: 'localhost', expected: true },
    { mode: 'development', dev: true, prod: true, flag: 'true', host: 'localhost', expected: false },
  ])('mode=$mode DEV=$dev PROD=$prod flag=$flag host=$host => $expected', async ({ mode, dev, prod, flag, host, expected }) => {
    vi.resetModules();
    vi.stubEnv('MODE', mode);
    vi.stubEnv('DEV', dev);
    vi.stubEnv('PROD', prod);
    vi.stubEnv('VITE_DEV_AUTH_BYPASS', flag);
    vi.stubGlobal('window', { location: { hostname: host } });

    const { isDevAuthBypassEnabled } = await import('./devAuth');

    expect(isDevAuthBypassEnabled).toBe(expected);
  });
});
