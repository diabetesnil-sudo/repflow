// RepFlow Multi-Tenant Enterprise PWA Service Worker (v8.0.0)
const CACHE_NAME = 'repflow-pwa-v8.0.0';
const DYNAMIC_CACHE = 'repflow-dynamic-v8.0.0';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/db-client.js',
  '/js/sw-register.js',
  '/js/app.js',
  '/manifest.json',
  '/icons/icon.svg'
];

// 1. Install Event: Cache App Shell & Immediately Skip Waiting
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing RepFlow PWA Shell...');
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching static app shell assets');
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[ServiceWorker] Non-critical pre-cache warning:', err);
      });
    })
  );
});

// 2. Activate Event: Wipe old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating RepFlow PWA Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME && cache !== DYNAMIC_CACHE) {
            console.log('[ServiceWorker] Clearing legacy cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event Strategy: Network-First for API, Cache-First / Stale-While-Revalidate for UI
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Exclude non-GET and browser extensions
  if (req.method !== 'GET' || !url.protocol.startsWith('http')) return;

  // A. API Requests: Network-First with Offline JSON Fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req).then(res => res).catch(async () => {
        console.warn('[ServiceWorker] API Network failed, returning offline fallback for:', url.pathname);
        return new Response(JSON.stringify({
          offline: true,
          message: 'Offline Mode Active. Operations queued locally in IndexedDB.',
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // B. Static UI Assets & Detailing Aids: Cache-First / Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch background update for cache freshness
        fetch(req).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(DYNAMIC_CACHE).then(cache => cache.put(req, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(req, responseToCache));
        }
        return networkResponse;
      }).catch(() => {
        // If navigating to an HTML page while offline, return cached index.html
        if (req.headers.get('accept') && req.headers.get('accept').includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// 4. Listen for User Commands (e.g. SKIP_WAITING for instant update)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 5. Background Sync Event
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-dcr-queue' || event.tag === 'sync-offline-queue') {
    event.waitUntil(notifyClientsToSync());
  }
});

async function notifyClientsToSync() {
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage({ type: 'FLUSH_OFFLINE_QUEUE' }));
}

// 6. Push Notifications
self.addEventListener('push', (event) => {
  let data = { title: 'RepFlow PWA Alert', body: 'New field force notification received.' };
  if (event.data) {
    try { data = event.data.json(); } catch (e) { data.body = event.data.text(); }
  }

  const options = {
    body: data.body,
    icon: '/icons/icon.svg',
    badge: '/icons/icon.svg',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Open RepFlow App' },
      { action: 'close', title: 'Dismiss' }
    ]
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
