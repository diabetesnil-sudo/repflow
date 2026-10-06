// Service Worker Registration and Sync Listener
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('[ServiceWorker] Registration successful with scope:', reg.scope);
      })
      .catch((err) => {
        console.error('[ServiceWorker] Registration failed:', err);
      });
  });

  // Listen for messages from ServiceWorker (e.g. background sync triggers)
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'FLUSH_OFFLINE_QUEUE') {
      console.log('[SW Message] Received flush command from ServiceWorker');
      if (window.RepFlowApp && window.RepFlowApp.syncOfflineData) {
        window.RepFlowApp.syncOfflineData();
      }
    }
  });
}

// Request Background Sync Registration Helper
async function registerBackgroundSync(tag = 'sync-dcr-queue') {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.sync.register(tag);
      console.log(`[BackgroundSync] Registered sync tag: ${tag}`);
    } catch (err) {
      console.warn('[BackgroundSync] Background Sync registration failed/unsupported:', err);
    }
  }
}
