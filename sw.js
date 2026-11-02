/* ===== Saregaana Service Worker ===== */

const CACHE_NAME = 'saregaana-shell-v1';

const CORE_FILES = [
  './',
  './index.html',
  './manifest.json',

  './styles/base.css',
  './styles/theme.css',
  './styles/fonts.css',

  './core/utils.js',
  './core/bus.js',
  './core/loader.js',
  './core/db.js',
  './core/tags.js',
  './core/posters.js',
  './core/lists.js',
  './core/player.js',
  './core/history.js',
  './core/app.js',

  './components/nav/nav.html',
  './components/nav/nav.css',
  './components/nav/nav.js',

  './components/mini/mini.html',
  './components/mini/mini.css',
  './components/mini/mini.js',

  './components/modal/modal.html',
  './components/modal/modal.css',
  './components/modal/modal.js',

  './components/row/row.html',
  './components/row/row.css',
  './components/row/row.js',

  './components/poster/poster.html',
  './components/poster/poster.css',
  './components/poster/poster.js',

  './components/toast/toast.html',
  './components/toast/toast.css',
  './components/toast/toast.js',

  './screens/splash/splash.html',
  './screens/splash/splash.css',
  './screens/splash/splash.js',

  './screens/radio/radio.html',
  './screens/radio/radio.css',
  './screens/radio/radio.js',

  './screens/library/library.html',
  './screens/library/library.css',
  './screens/library/library.js',

  './screens/add/add.html',
  './screens/add/add.css',
  './screens/add/add.js',

  './screens/playlists/playlists.html',
  './screens/playlists/playlists.css',
  './screens/playlists/playlists.js',

  './screens/player/player.html',
  './screens/player/player.css',
  './screens/player/player.js',

  './screens/lyrics/lyrics.html',
  './screens/lyrics/lyrics.css',
  './screens/lyrics/lyrics.js',

  './screens/profile/profile.html',
  './screens/profile/profile.css',
  './screens/profile/profile.js',

  './screens/settings/settings.html',
  './screens/settings/settings.css',
  './screens/settings/settings.js',

  './screens/stats/stats.html',
  './screens/stats/stats.css',
  './screens/stats/stats.js',

  './assets/icons/icon.svg'
];

/* Install: cache available application files */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        await Promise.allSettled(
          CORE_FILES.map(file => cache.add(file))
        );
      })
      .then(() => self.skipWaiting())
  );
});

/* Activate: remove older Saregaana caches */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key =>
            key.startsWith('saregaana-') &&
            key !== CACHE_NAME
          )
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

/* Fetch: network first for navigation, cache first for app files */
self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept external requests.
  if (url.origin !== self.location.origin) return;

  // HTML navigation: try network, then cached app shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put('./index.html', copy));
          }
          return response;
        })
        .catch(async () => {
          return (
            await caches.match(request) ||
            await caches.match('./index.html') ||
            Response.error()
          );
        })
    );

    return;
  }

  // Other same-origin app files.
  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(response => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(request, copy));
          }
          return response;
        });

      return cached || network;
    })
  );
});