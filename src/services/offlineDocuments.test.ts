import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '../lib/supabase';
import { getCachedDocumentUrl, getDocumentById, searchDocuments } from './supabaseService';
import type { Resource } from '../types';

vi.mock('../lib/supabase', () => ({
  assertSupabaseConfigured: vi.fn(),
  setRememberSessionPreference: vi.fn(),
  supabase: { auth: { getSession: vi.fn(), getUser: vi.fn() }, rpc: vi.fn() },
}));
vi.mock('../utils/devAuth', async (importOriginal) => ({
  ...await importOriginal<typeof import('../utils/devAuth')>(),
  isDevAuthBypassEnabled: false,
}));
import {
  clearOfflineDocumentData,
  decryptOfflineBlob,
  encryptOfflineBlob,
  encryptOfflineResponse,
  enforceOfflineDocumentOwner,
  getOfflineDocumentEncryptionKey,
  hasFreshOfflineDocumentTimestamp,
  isOfflineDocumentOwner,
  isRemoteOfflineSessionValid,
  markOfflineDocumentCached,
  OFFLINE_DOCUMENT_METADATA_STORE,
  purgeExpiredOfflineDocumentData,
  readEncryptedOfflineStore,
  shouldRevalidateOfflineSession,
  writeEncryptedOfflineStore,
} from '../utils/offlineDocuments';

const METADATA_KEY = 'flashover78-offline-document-metadata';
const OWNER_KEY = 'flashover78-offline-document-owner';
const TIMESTAMPS_KEY = 'flashover78-offline-document-cache-times';

function createFakeIndexedDb() {
  const databases = new Map<string, Map<string, Map<string, unknown>>>();

  const createDatabase = (stores: Map<string, Map<string, unknown>>) => ({
    objectStoreNames: {
      contains: (name: string) => stores.has(name),
    },
    createObjectStore: (name: string) => {
      stores.set(name, new Map());
      return {};
    },
    deleteObjectStore: (name: string) => stores.delete(name),
    transaction: (names: string | string[]) => {
      const storeNames = Array.isArray(names) ? names : [names];
      const storesForTransaction = storeNames.map((name) => {
        const store = stores.get(name);
        if (!store) {
          throw new Error(`Unknown fake IndexedDB store: ${name}`);
        }
        return [name, store] as const;
      });
      const transaction: {
        oncomplete: (() => void) | null;
        onerror: (() => void) | null;
        onabort: (() => void) | null;
        objectStore: () => {
          get: (key: string) => { result?: unknown; onsuccess?: () => void; onerror?: () => void };
          getAllKeys: () => { result?: unknown; onsuccess?: () => void; onerror?: () => void };
          put: (value: unknown, key: string) => void;
          delete: (key: string) => void;
          clear: () => void;
        };
      } = {
        oncomplete: null,
        onerror: null,
        onabort: null,
        objectStore: () => {
          const store = storesForTransaction[0][1];
          return {
          getAllKeys: () => {
            const request: { result?: unknown; onsuccess?: () => void; onerror?: () => void } = {};
            queueMicrotask(() => {
              request.result = [...store.keys()];
              request.onsuccess?.();
              queueMicrotask(() => transaction.oncomplete?.());
            });
            return request;
          },
          get: (key: string) => {
            const request: { result?: unknown; onsuccess?: () => void; onerror?: () => void } = {};
            queueMicrotask(() => {
              request.result = store.get(key);
              request.onsuccess?.();
              queueMicrotask(() => transaction.oncomplete?.());
            });
            return request;
          },
          put: (value: unknown, key: string) => {
            queueMicrotask(() => {
              store.set(key, value);
              queueMicrotask(() => transaction.oncomplete?.());
            });
          },
          delete: (key: string) => {
            queueMicrotask(() => {
              store.delete(key);
              queueMicrotask(() => transaction.oncomplete?.());
            });
          },
          clear: () => {
            queueMicrotask(() => {
              for (const [, currentStore] of storesForTransaction) {
                currentStore.clear();
              }
              queueMicrotask(() => transaction.oncomplete?.());
            });
          },
          };
        },
      };
      return transaction;
    },
    close: () => undefined,
  });

  return {
    open: (name: string, version: number) => {
      const request: {
        result?: ReturnType<typeof createDatabase>;
        error?: Error;
        onupgradeneeded?: () => void;
        onsuccess?: () => void;
        onerror?: () => void;
      } = {};
      queueMicrotask(() => {
        let stores = databases.get(name);
        const isNew = !stores;
        if (!stores) {
          stores = new Map();
          databases.set(name, stores);
        }
        request.result = createDatabase(stores);
        if (isNew || version >= 2) {
          request.onupgradeneeded?.();
        }
        request.onsuccess?.();
      });
      return request;
    },
    deleteDatabase: (name: string) => {
      const request: { onsuccess?: () => void; onerror?: () => void; onblocked?: () => void } = {};
      queueMicrotask(() => {
        databases.delete(name);
        request.onsuccess?.();
      });
      return request;
    },
  };
}

describe('private offline document lifecycle', () => {
  const matchCache = vi.fn<() => Promise<Response | undefined>>(async () => undefined);
  const deleteCache = vi.fn(async () => true);
  const deleteExpiredCacheEntry = vi.fn(async () => true);
  const openCache = vi.fn(async () => ({
    keys: async () => [{ url: 'https://app.flashover78.com/__offline_documents/private-document/1.0' }],
    delete: deleteExpiredCacheEntry,
    match: matchCache,
  }));
  const values = new Map<string, string>();
  const storage = {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };

  beforeEach(() => {
    values.clear();
    deleteCache.mockClear();
    deleteExpiredCacheEntry.mockClear();
    openCache.mockClear();
    matchCache.mockReset();
    vi.mocked(supabase.rpc).mockClear();
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'user-a' }, expires_at: Math.floor(Date.now() / 1000) + 3600 } },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getSession>>);
    vi.stubGlobal('navigator', { onLine: false });
    vi.stubGlobal('window', {
      location: { origin: 'https://app.flashover78.com' },
      localStorage: storage,
      caches: { delete: deleteCache, open: openCache },
      indexedDB: createFakeIndexedDb(),
    });
  });

  it('erases a legacy unowned cache before binding it to an account', async () => {
    window.localStorage.setItem(METADATA_KEY, '[{"id":"private-document"}]');

    await enforceOfflineDocumentOwner('user-a');

    expect(deleteCache).toHaveBeenCalledWith('flashover78-offline-documents-v1');
    expect(window.localStorage.getItem(METADATA_KEY)).toBeNull();
    expect(window.localStorage.getItem(OWNER_KEY)).not.toBe('user-a');
    expect(await isOfflineDocumentOwner('user-a')).toBe(true);
  });

  it('erases cached data on account change and logout', async () => {
    window.localStorage.setItem(OWNER_KEY, 'user-a');
    window.localStorage.setItem(METADATA_KEY, '[{"id":"private-document"}]');

    await enforceOfflineDocumentOwner('user-b');
    expect(window.localStorage.getItem(METADATA_KEY)).toBeNull();
    expect(window.localStorage.getItem(OWNER_KEY)).not.toBe('user-b');
    expect(await isOfflineDocumentOwner('user-b')).toBe(true);

    window.localStorage.setItem(METADATA_KEY, '[{"id":"other-document"}]');
    await clearOfflineDocumentData();
    expect(window.localStorage.getItem(METADATA_KEY)).toBeNull();
    expect(window.localStorage.getItem(OWNER_KEY)).toBeNull();
  });

  it('purges cached documents after the local retention window', async () => {
    await enforceOfflineDocumentOwner('user-a');
    const key = await getOfflineDocumentEncryptionKey('user-a');
    await writeEncryptedOfflineStore(
      OFFLINE_DOCUMENT_METADATA_STORE,
      'user-a',
      [{ id: 'private-document' }],
      key,
    );
    await markOfflineDocumentCached('private-document', 'user-a', 0);

    await purgeExpiredOfflineDocumentData(24 * 60 * 60 * 1000, 'user-a');

    expect(openCache).toHaveBeenCalledWith('flashover78-offline-documents-v1');
    expect(deleteExpiredCacheEntry).toHaveBeenCalled();
    expect(window.localStorage.getItem(METADATA_KEY)).toBeNull();
    expect(window.localStorage.getItem(TIMESTAMPS_KEY)).toBeNull();
    expect(await readEncryptedOfflineStore(OFFLINE_DOCUMENT_METADATA_STORE, 'user-a', key)).toEqual([]);
    expect(await hasFreshOfflineDocumentTimestamp('private-document', 'user-a', 24 * 60 * 60 * 1000)).toBe(false);
  });

  it('keeps independent deadlines when two documents are cached concurrently', async () => {
    await enforceOfflineDocumentOwner('user-a');
    await getOfflineDocumentEncryptionKey('user-a');
    await Promise.all([
      markOfflineDocumentCached('document-a', 'user-a', 100),
      markOfflineDocumentCached('document-b', 'user-a', 200),
    ]);
    expect(await hasFreshOfflineDocumentTimestamp('document-a', 'user-a', 300)).toBe(true);
    expect(await hasFreshOfflineDocumentTimestamp('document-b', 'user-a', 300)).toBe(true);
    expect(await hasFreshOfflineDocumentTimestamp('document-a', 'user-a', 100 + 24 * 60 * 60 * 1000)).toBe(false);
    expect(await hasFreshOfflineDocumentTimestamp('document-b', 'user-a', 100 + 24 * 60 * 60 * 1000)).toBe(true);
  });

  it('refuses a missing deadline, a future deadline and another account', async () => {
    await enforceOfflineDocumentOwner('user-a');
    expect(await hasFreshOfflineDocumentTimestamp('missing', 'user-a', 100)).toBe(false);
    await markOfflineDocumentCached('document-a', 'user-a', 200);
    expect(await hasFreshOfflineDocumentTimestamp('document-a', 'user-a', 100)).toBe(false);
    expect(await hasFreshOfflineDocumentTimestamp('document-a', 'user-b', 300)).toBe(false);
    expect(await hasFreshOfflineDocumentTimestamp('document-a', 'user-a', 200)).toBe(true);
  });

  it('discards prior generation caches and replaces their encryption key', async () => {
    await enforceOfflineDocumentOwner('user-a');
    const previousKey = await getOfflineDocumentEncryptionKey('user-a');
    window.localStorage.setItem(OWNER_KEY, window.localStorage.getItem(OWNER_KEY)!.replace('v2:', ''));
    await enforceOfflineDocumentOwner('user-a');
    const replacementKey = await getOfflineDocumentEncryptionKey('user-a');
    expect(replacementKey).not.toBe(previousKey);
    expect(window.localStorage.getItem(OWNER_KEY)).toMatch(/^v2:/);
  });

  it('fails closed when IndexedDB cannot read deadlines', async () => {
    vi.stubGlobal('window', { ...window, indexedDB: {
      open: () => { throw new Error('IDB unavailable'); },
    } });
    await expect(hasFreshOfflineDocumentTimestamp('document-a', 'user-a')).rejects.toThrow('IDB unavailable');
  });

  const resource = { id: 'private-document', versionLabel: '1.0' } as Resource;

  async function prepareCachedResponse() {
    await enforceOfflineDocumentOwner('user-a');
    const key = await getOfflineDocumentEncryptionKey('user-a');
    await markOfflineDocumentCached(resource.id, 'user-a');
    return encryptOfflineResponse(new Response('confidential document'), key);
  }

  it('restores a fresh encrypted document during a genuine network outage', async () => {
    matchCache.mockResolvedValue(await prepareCachedResponse());
    const blobUrl = await getCachedDocumentUrl(resource);
    expect(blobUrl).toMatch(/^blob:/);
    expect(await (await fetch(blobUrl!)).text()).toBe('confidential document');
    URL.revokeObjectURL(blobUrl!);
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
  });

  it('does not expose cached bytes with a missing deadline', async () => {
    await enforceOfflineDocumentOwner('user-a');
    matchCache.mockResolvedValue(new Response('legacy document'));
    expect(await getCachedDocumentUrl(resource)).toBeNull();
    expect(matchCache).not.toHaveBeenCalled();
  });

  it('refuses a document if the account changes during the asynchronous read', async () => {
    const encrypted = await prepareCachedResponse();
    matchCache.mockImplementationOnce(async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: { id: 'user-b' } } }, error: null,
      } as Awaited<ReturnType<typeof supabase.auth.getSession>>);
      return encrypted;
    });
    expect(await getCachedDocumentUrl(resource)).toBeNull();
  });

  it('rechecks expiration after asynchronous decryption', async () => {
    const encrypted = await prepareCachedResponse();
    matchCache.mockImplementationOnce(async () => {
      await markOfflineDocumentCached(resource.id, 'user-a', Date.now() - 24 * 60 * 60 * 1000);
      return encrypted;
    });
    expect(await getCachedDocumentUrl(resource)).toBeNull();
    expect(deleteExpiredCacheEntry).toHaveBeenCalled();
  });

  it('refuses restoration if IndexedDB becomes unavailable', async () => {
    await enforceOfflineDocumentOwner('user-a');
    window.indexedDB.open = () => { throw new Error('IDB unavailable'); };
    expect(await getCachedDocumentUrl(resource)).toBeNull();
  });

  it('loads catalogue and detail metadata offline without any RPC and excludes missing deadlines', async () => {
    await prepareCachedResponse();
    const key = await getOfflineDocumentEncryptionKey('user-a');
    const cachedMetadata = {
      ...resource, title: 'Document', authorName: '', originalFilename: 'document.pdf',
      tags: [], category: 'AUTRE', effectiveAt: null, expiresAt: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    await writeEncryptedOfflineStore(OFFLINE_DOCUMENT_METADATA_STORE, 'user-a', [
      cachedMetadata, { ...cachedMetadata, id: 'without-deadline' },
    ], key);
    expect((await getDocumentById(resource.id))?.id).toBe(resource.id);
    expect((await searchDocuments()).map((item) => item.id)).toEqual([resource.id]);
    expect(await getDocumentById('without-deadline')).toBeNull();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('revalidates Auth online but preserves the explicit offline mode', () => {
    expect(shouldRevalidateOfflineSession(false, true)).toBe(true);
    expect(shouldRevalidateOfflineSession(false, false)).toBe(false);
    expect(shouldRevalidateOfflineSession(true, true)).toBe(false);
  });

  it('requires both the same Auth user and a live server session online', () => {
    expect(isRemoteOfflineSessionValid('user-a', 'user-a', null, true, null)).toBe(true);
    expect(isRemoteOfflineSessionValid('user-a', 'user-a', null, false, null)).toBe(false);
    expect(isRemoteOfflineSessionValid('user-a', 'user-b', null, true, null)).toBe(false);
    expect(isRemoteOfflineSessionValid('user-a', 'user-a', new Error('revoked'), true, null)).toBe(false);
  });

  it('encrypts document bytes at rest and decrypts them only with the account key', async () => {
    expect(globalThis.crypto?.subtle).toBeDefined();
    const key = await globalThis.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
    const original = new Blob(['document confidentiel'], { type: 'application/pdf' });
    const encrypted = await encryptOfflineBlob(original, key);

    expect(encrypted.type).toBe('application/octet-stream');
    expect(new TextDecoder().decode(await encrypted.arrayBuffer())).not.toContain('document confidentiel');

    const decrypted = await decryptOfflineBlob(encrypted, key);
    expect(decrypted.type).toBe('application/pdf');
    expect(await decrypted.text()).toBe('document confidentiel');
  });
});
