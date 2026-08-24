// sw.js - Service Worker con auto-actualización forzada y purga de caché vieja
const CACHE_NAME = 'cotizador-pro-v2.8';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './css/styles.css',
    './js/firebase-config.js',
    './js/db.js',
    './js/vinilos.js',
    './js/pdf-generator.js',
    './js/cotizador.js',
    './js/app.js',
    './manifest.json'
];

self.addEventListener('install', (event) => {
    // Forzar activación inmediata sin esperar a que se cierren pestañas
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('activate', (event) => {
    // Eliminar absolutamente todas las cachés viejas (incluyendo v1)
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('Eliminando caché antigua:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // Estrategia Network-First para archivos HTML y JS para que siempre muestre la última versión
    if (event.request.mode === 'navigate' || event.request.destination === 'script' || event.request.destination === 'style') {
        event.respondWith(
            fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                return caches.match(event.request).then((cached) => cached || caches.match('./index.html'));
            })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request);
        })
    );
});
