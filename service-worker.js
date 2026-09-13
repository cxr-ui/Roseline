/* Roseline · LANTERN — service worker
   App shell is cached for offline use. Anything to api.anthropic.com
   always goes to the network (chat obviously needs a connection) —
   this worker never caches or replays your API key or messages.
*/

const CACHE_NAME = 'roseline-lantern-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './styles.css',
  './avatar.js',
  './app.js',
  './manifest.json',
  './system_prompt.txt',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept the Claude API — always live network, never cached.
  if (url.hostname === 'api.anthropic.com') return;

  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((res) => {
          if (res && res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
