const CACHE_NAME = 'repflow-v6.0.0-final';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/db-client.js',
  '/js/sw-register.js',
  '/js/app.js',
  '/manifest.json'
];

// 1. Install Event: Cache App Shell & Immediately Skip Waiting
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing RepFlow v6.0.0 App Shell...');
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching updated static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// 2. Activate Event: Wipe ALL old caches instantly
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating RepFlow v6.0.0 Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          console.log('[ServiceWorker] Deleting cache:', cache);
          return caches.delete(cache);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event: Network-First for Development to prevent stale cache issues
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req).catch(() => {
        if (req.method === 'GET') {
          return new Response(JSON.stringify({ offline: true, message: 'Offline mode active.' }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return Promise.reject('Offline');
      })
    );
    return;
  }

  // Network-First for JS and CSS static assets
  event.respondWith(
    fetch(req).then((networkResponse) => {
      if (req.method === 'GET' && networkResponse.status === 200) {
        const copy = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
      }
      return networkResponse;
    }).catch(() => caches.match(req))
  );
});

// 4. Background Sync & Push Listeners
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-dcr-queue') {
    event.waitUntil(triggerOfflineSync());
  }
});

async function triggerOfflineSync() {
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage({ type: 'FLUSH_OFFLINE_QUEUE' }));
}

self.addEventListener('push', (event) => {
  let data = { title: 'RepFlow Alert', body: 'New system notification received.' };
  if (event.data) {
    try { data = event.data.json(); } catch (e) { data.body = event.data.text(); }
  }

  const options = {
    body: data.body,
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%2300b4d8"/><text x="50" y="65" font-size="45" font-weight="800" fill="white" text-anchor="middle" font-family="sans-serif">RF</text></svg>',
    vibrate: [100, 50, 100]
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (let client of clientList) {
        if (client.url === '/' && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
