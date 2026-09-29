/* GoCav Transport — PWA service worker
   Strategy: cache the app shell (page + icons + manifest).
   Navigations: network-first, fall back to cached page when offline.
   Same-origin static assets: cache-first.
   Cross-origin (Tailwind CDN, fonts, imgur, Google Apps Script, WhatsApp, Viber):
   pass through untouched (no opaque-response caching to avoid storage bloat). */

var CACHE = 'gocav-v1';
var SHELL = [
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(
          keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })
        );
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  // Cross-origin requests go straight to the network.
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put('./index.html', copy); });
          return res;
        })
        .catch(function () { return caches.match('./index.html'); })
    );
    return;
  }

  // Same-origin static assets: cache-first with network fallback.
  e.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
    })
  );
});
