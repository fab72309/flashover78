const CACHE_NAME = 'flashover78-v4';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/images/logo-sapeurs-pompiers.png'
];
const STATIC_ASSET_PATTERN = /\.(?:css|js|json|webmanifest|png|jpe?g|gif|svg|ico|webp|woff2?|ttf)$/i;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.hostname.endsWith('.supabase.co')
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // PDF/DOCX templates must always reflect the deployed version. A previous
  // SPA fallback response must never be allowed to masquerade as a template.
  if (url.pathname.startsWith('/templates/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Only cache immutable/static application assets. In particular, never
  // cache a same-origin API, function, auth or future private route by
  // accident; private documents have their own account-bound cache lifecycle.
  if (!STATIC_ASSET_PATTERN.test(url.pathname)) {
    return;
  }

  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Do not cache HTML returned for a missing asset. This avoids serving
        // the app shell when a later release adds that asset.
        if ((response.headers.get('content-type') || '').includes('text/html')) {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache));
        return response;
      });
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => Promise.all(
        cacheNames
          // Only rotate application-shell caches. Private offline documents
          // have their own lifecycle and are erased on logout/account change.
          .filter(cacheName =>
            cacheName.startsWith('flashover78-v') && cacheName !== CACHE_NAME
          )
          .map(cacheName => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});
