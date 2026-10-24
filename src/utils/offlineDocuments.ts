export const OFFLINE_DOCUMENT_CACHE = 'flashover78-offline-documents-v1';
export const OFFLINE_DOCUMENTS_STORAGE_KEY = 'flashover78-offline-document-metadata';
export const OFFLINE_DOCUMENT_OWNER_STORAGE_KEY = 'flashover78-offline-document-owner';
export const OFFLINE_DOCUMENT_CACHE_TIMESTAMPS_STORAGE_KEY = 'flashover78-offline-document-cache-times';
export const OFFLINE_DOCUMENT_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const OFFLINE_DOCUMENT_ENCRYPTION_HEADER = 'x-flashover78-offline-encrypted';
export const OFFLINE_DOCUMENT_ENCRYPTION_VERSION = '1';

const OFFLINE_DOCUMENT_KEY_DATABASE = 'flashover78-offline-document-keys-v1';
const OFFLINE_DOCUMENT_KEY_STORE = 'keys';
export const OFFLINE_DOCUMENT_METADATA_STORE = 'metadata';
export const OFFLINE_DOCUMENT_TIMESTAMPS_STORE = 'timestamps';
const OFFLINE_DOCUMENT_DATABASE_VERSION = 2;

type OfflineDocumentTimestamps = Record<string, number>;

function getSubtleCrypto() {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle || typeof cryptoApi.getRandomValues !== 'function') {
    throw new Error('Le chiffrement du stockage hors ligne n’est pas disponible.');
  }
  return cryptoApi;
}

function openOfflineKeyDatabase(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    throw new Error('Le stockage chiffré hors ligne n’est pas disponible.');
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(
      OFFLINE_DOCUMENT_KEY_DATABASE,
      OFFLINE_DOCUMENT_DATABASE_VERSION,
    );
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(OFFLINE_DOCUMENT_KEY_STORE)) {
        request.result.createObjectStore(OFFLINE_DOCUMENT_KEY_STORE);
      }
      if (!request.result.objectStoreNames.contains(OFFLINE_DOCUMENT_METADATA_STORE)) {
        request.result.createObjectStore(OFFLINE_DOCUMENT_METADATA_STORE);
      }
      if (!request.result.objectStoreNames.contains(OFFLINE_DOCUMENT_TIMESTAMPS_STORE)) {
        request.result.createObjectStore(OFFLINE_DOCUMENT_TIMESTAMPS_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Ouverture du stockage chiffré impossible.'));
  });
}

function hasOfflineIndexedDb() {
  return typeof window !== 'undefined' && Boolean(window.indexedDB);
}

export async function readEncryptedOfflineStore<T>(
  storeName: string,
  userId: string,
  key: CryptoKey,
): Promise<T | null> {
  if (!hasOfflineIndexedDb()) {
    return null;
  }

  const database = await openOfflineKeyDatabase();
  try {
    const storedValue = await new Promise<Blob | undefined>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readonly');
      const request = transaction.objectStore(storeName).get(userId);
      request.onsuccess = () => resolve(request.result as Blob | undefined);
      request.onerror = () => reject(request.error ?? new Error('Lecture du stockage hors ligne impossible.'));
    });

    if (!storedValue) {
      return null;
    }

    const decrypted = await decryptOfflineBlob(
      storedValue instanceof Blob ? storedValue : new Blob([storedValue]),
      key,
    );
    return JSON.parse(await decrypted.text()) as T;
  } finally {
    database.close();
  }
}

export async function writeEncryptedOfflineStore(
  storeName: string,
  userId: string,
  value: unknown,
  key: CryptoKey,
) {
  if (!hasOfflineIndexedDb()) {
    return;
  }

  const database = await openOfflineKeyDatabase();
  try {
    const encrypted = await encryptOfflineBlob(
      new Blob([JSON.stringify(value)], { type: 'application/json' }),
      key,
    );
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      transaction.objectStore(storeName).put(encrypted, userId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Écriture du stockage hors ligne impossible.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Écriture du stockage hors ligne impossible.'));
    });
  } finally {
    database.close();
  }
}

async function deleteEncryptedOfflineStoreEntry(storeName: string, userId: string) {
  if (!hasOfflineIndexedDb()) {
    return;
  }

  const database = await openOfflineKeyDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      transaction.objectStore(storeName).delete(userId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Suppression du stockage hors ligne impossible.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Suppression du stockage hors ligne impossible.'));
    });
  } finally {
    database.close();
  }
}

async function getOfflineOwnerMarker(userId: string) {
  const digest = await getSubtleCrypto().subtle.digest(
    'SHA-256',
    new TextEncoder().encode(userId),
  );
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

export async function getOfflineDocumentEncryptionKey(userId: string): Promise<CryptoKey> {
  const cryptoApi = getSubtleCrypto();
  const database = await openOfflineKeyDatabase();

  try {
    const storedKey = await new Promise<CryptoKey | undefined>((resolve, reject) => {
      const transaction = database.transaction(OFFLINE_DOCUMENT_KEY_STORE, 'readonly');
      const request = transaction.objectStore(OFFLINE_DOCUMENT_KEY_STORE).get(userId);
      request.onsuccess = () => resolve(request.result as CryptoKey | undefined);
      request.onerror = () => reject(request.error ?? new Error('Lecture de la clé hors ligne impossible.'));
    });

    if (storedKey) {
      return storedKey;
    }

    const generatedKey = await cryptoApi.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(OFFLINE_DOCUMENT_KEY_STORE, 'readwrite');
      transaction.objectStore(OFFLINE_DOCUMENT_KEY_STORE).put(generatedKey, userId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Enregistrement de la clé hors ligne impossible.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Enregistrement de la clé hors ligne impossible.'));
    });
    return generatedKey;
  } finally {
    database.close();
  }
}

function deleteOfflineEncryptionKeys() {
  if (!hasOfflineIndexedDb()) {
    return Promise.resolve();
  }

  return openOfflineKeyDatabase()
    .then((database) => new Promise<void>((resolve) => {
      const transaction = database.transaction(
        [
          OFFLINE_DOCUMENT_KEY_STORE,
          OFFLINE_DOCUMENT_METADATA_STORE,
          OFFLINE_DOCUMENT_TIMESTAMPS_STORE,
        ],
        'readwrite',
      );
      for (const storeName of [
        OFFLINE_DOCUMENT_KEY_STORE,
        OFFLINE_DOCUMENT_METADATA_STORE,
        OFFLINE_DOCUMENT_TIMESTAMPS_STORE,
      ]) {
        transaction.objectStore(storeName).clear();
      }
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => {
        database.close();
        resolve();
      };
      transaction.onabort = () => {
        database.close();
        resolve();
      };
    }))
    .catch(() => undefined);
}

export async function encryptOfflineBlob(blob: Blob, key: CryptoKey): Promise<Blob> {
  const cryptoApi = getSubtleCrypto();
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const cipherText = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    await blob.arrayBuffer(),
  );
  const metadata = new TextEncoder().encode(JSON.stringify({
    version: OFFLINE_DOCUMENT_ENCRYPTION_VERSION,
    mimeType: blob.type || 'application/octet-stream',
    iv: Array.from(iv),
  }));
  const prefix = new Uint8Array(4);
  new DataView(prefix.buffer).setUint32(0, metadata.byteLength);
  return new Blob([prefix, metadata, cipherText], { type: 'application/octet-stream' });
}

export async function decryptOfflineBlob(blob: Blob, key: CryptoKey): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.byteLength < 4) {
    throw new Error('Document hors ligne chiffré invalide.');
  }

  const metadataLength = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0);
  const metadataStart = 4;
  const cipherStart = metadataStart + metadataLength;
  if (metadataLength <= 0 || cipherStart >= bytes.byteLength) {
    throw new Error('Document hors ligne chiffré invalide.');
  }

  const metadata = JSON.parse(
    new TextDecoder().decode(bytes.slice(metadataStart, cipherStart)),
  ) as { version?: unknown; mimeType?: unknown; iv?: unknown };
  if (
    metadata.version !== OFFLINE_DOCUMENT_ENCRYPTION_VERSION
    || typeof metadata.mimeType !== 'string'
    || !Array.isArray(metadata.iv)
    || metadata.iv.length !== 12
    || metadata.iv.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
  ) {
    throw new Error('Document hors ligne chiffré invalide.');
  }

  const plainText = await getSubtleCrypto().subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(metadata.iv as number[]) },
    key,
    bytes.slice(cipherStart),
  );
  return new Blob([plainText], { type: metadata.mimeType });
}

export async function encryptOfflineResponse(response: Response, key: CryptoKey) {
  const encryptedBody = await encryptOfflineBlob(await response.blob(), key);
  return new Response(encryptedBody, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      [OFFLINE_DOCUMENT_ENCRYPTION_HEADER]: OFFLINE_DOCUMENT_ENCRYPTION_VERSION,
    },
  });
}

export async function decryptOfflineResponse(response: Response, key: CryptoKey) {
  if (response.headers.get(OFFLINE_DOCUMENT_ENCRYPTION_HEADER) !== OFFLINE_DOCUMENT_ENCRYPTION_VERSION) {
    throw new Error('Ancien document hors ligne non chiffré.');
  }
  return decryptOfflineBlob(await response.blob(), key);
}

export function shouldRevalidateOfflineSession(isDevAuthBypass: boolean, isOnline: boolean) {
  return !isDevAuthBypass && isOnline;
}

export function isRemoteOfflineSessionValid(
  expectedUserId: string,
  remoteUserId: string | null | undefined,
  remoteUserError: unknown,
  activeSession: boolean | null | undefined,
  activeSessionError: unknown,
) {
  return !remoteUserError
    && !activeSessionError
    && remoteUserId === expectedUserId
    && activeSession === true;
}

async function readCacheTimestamps(userId: string): Promise<OfflineDocumentTimestamps> {
  if (!hasOfflineIndexedDb()) {
    return {};
  }

  const key = await getOfflineDocumentEncryptionKey(userId);
  const value = await readEncryptedOfflineStore<OfflineDocumentTimestamps>(
    OFFLINE_DOCUMENT_TIMESTAMPS_STORE,
    userId,
    key,
  );
  if (!value || typeof value !== 'object') {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter(([, timestamp]) => typeof timestamp === 'number'),
  ) as OfflineDocumentTimestamps;
}

async function writeCacheTimestamps(userId: string, value: OfflineDocumentTimestamps) {
  if (Object.keys(value).length === 0) {
    await deleteEncryptedOfflineStoreEntry(OFFLINE_DOCUMENT_TIMESTAMPS_STORE, userId);
    return;
  }
  await writeEncryptedOfflineStore(
    OFFLINE_DOCUMENT_TIMESTAMPS_STORE,
    userId,
    value,
    await getOfflineDocumentEncryptionKey(userId),
  );
}

export async function markOfflineDocumentCached(
  resourceId: string,
  userId: string,
  cachedAt = Date.now(),
) {
  if (typeof window === 'undefined') return;
  const timestamps = await readCacheTimestamps(userId);
  timestamps[resourceId] = cachedAt;
  await writeCacheTimestamps(userId, timestamps);
}

export async function isOfflineDocumentOwner(userId: string) {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(OFFLINE_DOCUMENT_OWNER_STORAGE_KEY)
    === await getOfflineOwnerMarker(userId);
}

export async function clearOfflineDocumentTimestamp(resourceId: string, userId: string) {
  if (typeof window === 'undefined') return;
  const timestamps = await readCacheTimestamps(userId);
  delete timestamps[resourceId];
  await writeCacheTimestamps(userId, timestamps);
}

export async function purgeExpiredOfflineDocumentData(
  now = Date.now(),
  userId?: string,
) {
  if (typeof window === 'undefined') return;

  // Never retain the old plaintext metadata format after this code has run,
  // even when no encrypted entry has reached its TTL yet.
  window.localStorage.removeItem(OFFLINE_DOCUMENTS_STORAGE_KEY);
  window.localStorage.removeItem(OFFLINE_DOCUMENT_CACHE_TIMESTAMPS_STORAGE_KEY);

  // Remove data written by the pre-encryption implementation. Production
  // browsers with no IndexedDB cannot cache encrypted private documents and
  // must fail closed instead of falling back to plaintext metadata.
  if (!userId || !hasOfflineIndexedDb()) {
    return;
  }

  let timestamps: OfflineDocumentTimestamps;
  try {
    timestamps = await readCacheTimestamps(userId);
  } catch {
    await clearOfflineDocumentData();
    return;
  }
  const expiredIds = Object.entries(timestamps)
    .filter(([, cachedAt]) => now - cachedAt >= OFFLINE_DOCUMENT_CACHE_MAX_AGE_MS)
    .map(([resourceId]) => resourceId);

  if (expiredIds.length === 0) return;

  const cacheStorage = window.caches;
  if (cacheStorage && typeof cacheStorage.open === 'function') {
    const cache = await cacheStorage.open(OFFLINE_DOCUMENT_CACHE);
    const keys = await cache.keys();
    await Promise.all(
      keys
        .filter((request) => expiredIds.some((resourceId) =>
          request.url.includes(`/__offline_documents/${resourceId}/`)))
        .map((request) => cache.delete(request)),
    );
  }

  try {
    const key = await getOfflineDocumentEncryptionKey(userId);
    const metadata = await readEncryptedOfflineStore<Array<{ id?: unknown }>>(
      OFFLINE_DOCUMENT_METADATA_STORE,
      userId,
      key,
    );
    if (metadata) {
      await writeEncryptedOfflineStore(
        OFFLINE_DOCUMENT_METADATA_STORE,
        userId,
        metadata.filter((resource) =>
          typeof resource.id !== 'string' || !expiredIds.includes(resource.id)),
        key,
      );
    }
  } catch {
    await clearOfflineDocumentData();
    return;
  }

  for (const resourceId of expiredIds) {
    delete timestamps[resourceId];
  }
  await writeCacheTimestamps(userId, timestamps);
}

export async function clearOfflineDocumentData() {
  if (typeof window === 'undefined') {
    return;
  }

  if ('caches' in window) {
    await window.caches.delete(OFFLINE_DOCUMENT_CACHE);
  }

  window.localStorage.removeItem(OFFLINE_DOCUMENTS_STORAGE_KEY);
  window.localStorage.removeItem(OFFLINE_DOCUMENT_OWNER_STORAGE_KEY);
  window.localStorage.removeItem(OFFLINE_DOCUMENT_CACHE_TIMESTAMPS_STORAGE_KEY);
  await deleteOfflineEncryptionKeys();
}

/**
 * Bind cached private documents to one authenticated account. Legacy caches
 * without an owner marker and caches belonging to another account are erased
 * before any metadata is exposed.
 */
export async function enforceOfflineDocumentOwner(userId: string | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!userId) {
    await clearOfflineDocumentData();
    return;
  }

  let expectedOwnerMarker: string;
  try {
    expectedOwnerMarker = await getOfflineOwnerMarker(userId);
  } catch {
    // A browser without WebCrypto cannot safely expose private offline data;
    // keep the normal authenticated app usable while disabling that cache.
    await clearOfflineDocumentData();
    return;
  }
  const cachedOwnerMarker = window.localStorage.getItem(
    OFFLINE_DOCUMENT_OWNER_STORAGE_KEY,
  );

  // Owner markers are one-way hashes. The raw Auth UUID is never persisted in
  // localStorage, and a missing/legacy marker invalidates any pre-encryption
  // cache before the current account can use it.
  if (cachedOwnerMarker !== expectedOwnerMarker) {
    await clearOfflineDocumentData();
  }

  await purgeExpiredOfflineDocumentData(Date.now(), userId);
  window.localStorage.setItem(OFFLINE_DOCUMENT_OWNER_STORAGE_KEY, expectedOwnerMarker);
}
