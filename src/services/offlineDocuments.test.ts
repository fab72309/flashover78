import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearOfflineDocumentData,
  decryptOfflineBlob,
  encryptOfflineBlob,
  enforceOfflineDocumentOwner,
  getOfflineDocumentEncryptionKey,
  isOfflineDocumentOwner,
  isRemoteOfflineSessionValid,
  markOfflineDocumentCached,
  OFFLINE_DOCUMENT_METADATA_STORE,
  OFFLINE_DOCUMENT_TIMESTAMPS_STORE,
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
  const deleteCache = vi.fn(async () => true);
  const deleteExpiredCacheEntry = vi.fn(async () => true);
  const openCache = vi.fn(async () => ({
    keys: async () => [{ url: 'https://app.flashover78.com/__offline_documents/private-document/1.0' }],
    delete: deleteExpiredCacheEntry,
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
    vi.stubGlobal('window', {
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
    expect(await readEncryptedOfflineStore(OFFLINE_DOCUMENT_TIMESTAMPS_STORE, 'user-a', key)).toBeNull();
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
