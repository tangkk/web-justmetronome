const CACHE_NAME = 'just-metronome-cache-v2';
const ASSETS = [
  './',
  './index.html',
  './404.html',
  './styles.css',
  './script.js',
  './site.webmanifest',
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
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
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
