// sw.js - Service Worker para Soporte Offline y PWA
const CACHE_NAME = 'cotizador-pro-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './css/styles.css',
    './js/db.js',
    './js/vinilos.js',
    './js/pdf-generator.js',
    './js/cotizador.js',
    './js/app.js',
    './manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request).catch(() => {
                // Fallback offline
                return caches.match('./index.html');
            });
        })
    );
});
