const CACHE_NAME = 'just-metronome-cache-v4';
const ASSETS = [
  './',
  './index.html',
  './404.html',
  './styles.css',
  './script.js',
  './site.webmanifest',
  './favicon.svg?v=20260921',
  './favicon.ico?v=20260921',
  './apple-touch-icon.png?v=20260921',
  './assets/just-click.wav',
  './assets/hollow-click.wav',
  './assets/drum-stick.wav',
  './assets/practice-pad.wav',
  './assets/met-quartz.wav',
  './assets/perc-snap.wav',
  './assets/focus-ding.mp3',
  './assets/clicked.mp3',
  './assets/ding.mp3',
  './assets/light-clicked.wav',
  './assets/swiped.wav',
  './assets/og-cover.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Pages go network-first (revalidated, ignoring the 10-minute HTTP cache) so an
  // updated index.html is never hidden behind either cache.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
