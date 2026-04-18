const CACHE_NAME = 'bj-counter-v3.0.32';
const ASSETS = [
  '/bj-counter/',
  '/bj-counter/index.html',
  '/bj-counter/styles.css',
  '/bj-counter/app.js',
  '/bj-counter/manifest.json',
  '/bj-counter/icon-192.png',
  '/bj-counter/icon-512.png'
];

// Install: cache local assets only (skip external CDN yang bisa gagal)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: hapus cache lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: hanya handle http/https, abaikan chrome-extension dll
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Abaikan request non-http (chrome-extension://, etc.)
  if (!url.startsWith('http')) return;

  const isLocal = url.startsWith(self.location.origin);

  if (isLocal) {
    // Cache-first untuk file lokal (app shell)
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200 && response.type !== 'opaque') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        });
      })
    );
  } else {
    // Network-first untuk CDN & fonts, fallback ke cache
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
