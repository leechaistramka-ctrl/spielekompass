/**
 * Service Worker = kleiner Hintergrunddienst, der die App-Dateien zwischenspeichert.
 * Dadurch startet die App auch ohne Internet.
 *
 * WICHTIG: Nach jeder Änderung an App-Dateien die Versionsnummer in CACHE erhöhen,
 * damit Geräte die neue Fassung laden.
 */
const CACHE = 'leeway-spielekompass-v1.1.0';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/modules.css',
  './js/app.js',
  './js/config.js',
  './js/core/store.js',
  './js/core/adapters/local-storage.js',
  './js/core/router.js',
  './js/core/ui.js',
  './js/core/icons.js',
  './js/core/utils.js',
  './js/core/image-store.js',
  './js/components/game-data.js',
  './js/components/game-ui.js',
  './js/components/game-bgg.js',
  './js/modules/index.js',
  './js/modules/games.js',
  './js/modules/settings.js',
  './js/modules/legal.js',
  './assets/brand/signet-hellgold.svg',
  './assets/brand/signet-waldgruen.svg',
  './assets/brand/wortbildmarke-hellgold.svg',
  './assets/brand/panorama.jpg',
  './assets/brand/topo.svg',
  './assets/brand/trail.svg',
  './assets/fonts/lato-latin-300-normal.woff2',
  './assets/fonts/lato-latin-400-normal.woff2',
  './assets/fonts/lato-latin-700-normal.woff2',
  './assets/fonts/lato-latin-900-normal.woff2',
  './assets/fonts/noto-serif-latin-400-italic.woff2',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' umgeht den Browser-Zwischenspeicher, damit wirklich die neuen Dateien geladen werden.
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('leeway-spielekompass-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Strategie „Zwischenspeicher zuerst, im Hintergrund aktualisieren“.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      const res = await network;
      if (res) return res;
      if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
      return Response.error();
    }),
  );
});
